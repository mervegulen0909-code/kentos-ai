import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

export interface KpsVerifyResult {
  verified: boolean;
  fullName?: string;
  tckn?: string;
  birthYear?: number;
}

/**
 * e-Devlet KPS (Kimlik Paylaşım Sistemi) entegrasyonu.
 *
 * Gerçek KPS erişimi için:
 * 1. T.C. Kimlik Paylaşım Sistemi sözleşmesi imzalanmalı
 * 2. KPS_ENDPOINT, KPS_USERNAME, KPS_PASSWORD ortam değişkenleri ayarlanmalı
 * 3. KPS SOAP/REST API belgeleri için: https://kps.nvi.gov.tr
 *
 * Bu implementasyon production'a hazır bir stub'dır.
 */
@Injectable()
export class EdevletService {
  private readonly logger = new Logger(EdevletService.name);

  async verifyIdentity(dto: {
    tckn: string;
    firstName: string;
    lastName: string;
    birthYear: number;
  }): Promise<KpsVerifyResult> {
    const endpoint = process.env.KPS_ENDPOINT;

    if (!endpoint) {
      this.logger.warn('KPS_ENDPOINT not configured — returning mock verification');
      // Dev/test mode: accept any 11-digit TCKN that passes Luhn-like check
      if (this.isValidTckn(dto.tckn)) {
        return { verified: true, fullName: `${dto.firstName} ${dto.lastName}`, tckn: dto.tckn, birthYear: dto.birthYear };
      }
      return { verified: false };
    }

    // Production: call KPS
    return this.callKps(dto, endpoint);
  }

  private async callKps(dto: {
    tckn: string;
    firstName: string;
    lastName: string;
    birthYear: number;
  }, endpoint: string): Promise<KpsVerifyResult> {
    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://kps.nvi.gov.tr/2011/01/01">
  <soap:Header>
    <tns:KPSHeader>
      <tns:IslemId>${Date.now()}</tns:IslemId>
    </tns:KPSHeader>
  </soap:Header>
  <soap:Body>
    <tns:TCKimlikNoDogrula>
      <tns:TCKimlikNo>${dto.tckn}</tns:TCKimlikNo>
      <tns:Ad>${dto.firstName.toUpperCase()}</tns:Ad>
      <tns:Soyad>${dto.lastName.toUpperCase()}</tns:Soyad>
      <tns:DogumYili>${dto.birthYear}</tns:DogumYili>
    </tns:TCKimlikNoDogrula>
  </soap:Body>
</soap:Envelope>`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '"http://kps.nvi.gov.tr/2011/01/01/TCKimlikNoDogrula"',
          Authorization: `Basic ${Buffer.from(`${process.env.KPS_USERNAME ?? ''}:${process.env.KPS_PASSWORD ?? ''}`).toString('base64')}`,
        },
        body: soapBody,
      });

      if (!res.ok) {
        this.logger.error(`KPS returned ${res.status}`);
        throw new UnauthorizedException('KPS doğrulaması başarısız');
      }

      const xml = await res.text();
      const verified = xml.includes('<TCKimlikNoDogrulaSonuc>true</TCKimlikNoDogrulaSonuc>');

      return { verified, tckn: dto.tckn, fullName: `${dto.firstName} ${dto.lastName}`, birthYear: dto.birthYear };
    } catch (e) {
      this.logger.error(`KPS call failed: ${e}`);
      throw new UnauthorizedException('Kimlik doğrulama servisi şu anda kullanılamıyor');
    }
  }

  private isValidTckn(tckn: string): boolean {
    if (!/^\d{11}$/.test(tckn)) return false;
    if (tckn[0] === '0') return false;
    const d = tckn.split('').map(Number);
    const sum10 = (d[0]! + d[2]! + d[4]! + d[6]! + d[8]!) * 7 - (d[1]! + d[3]! + d[5]! + d[7]!);
    if (((sum10 % 10) + 10) % 10 !== d[9]) return false;
    const sum11 = d.slice(0, 10).reduce((a, b) => a + b, 0);
    return sum11 % 10 === d[10];
  }
}
