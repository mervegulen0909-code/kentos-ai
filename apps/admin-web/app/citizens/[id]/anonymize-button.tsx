'use client';

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function AnonymizeCitizenButton({ action }: Props) {
  return (
    <form action={action}>
      <button
        type="submit"
        style={{ background: 'var(--error, #dc2626)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
        onClick={(event) => {
          if (!window.confirm('Bu vatandasin kisisel verileri kalici olarak silinecek. Bu islem geri alinamaz. Onayliyor musunuz?')) {
            event.preventDefault();
          }
        }}
      >
        Kisisel Verileri Anonimlestir (KVKK)
      </button>
    </form>
  );
}
