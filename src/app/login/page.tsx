import LoginForm from './login-form';

export const metadata = { title: 'Přihlášení | iSYS' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="login">
      <div className="logo">iSYS<span> / TECH</span></div>
      <h1>Přihlášení</h1>
      <p className="muted">Účty zakládá správce v Supabase. Registrace není veřejná.</p>
      <LoginForm next={next} />
    </div>
  );
}
