import LoginForm from './login-form';

export const metadata = { title: 'Přihlášení | iSYS' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="login">
      <div className="logo">
        <span className="mark" aria-hidden="true" />
        iSYS
      </div>
      <div>
        <h1>Přihlášení</h1>
        <p className="muted">Účty zakládá správce. Registrace není veřejná.</p>
      </div>
      <LoginForm next={next} />
    </div>
  );
}
