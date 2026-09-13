import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AdminBrand from "../../components/admin/AdminBrand";
import CircularBadge from "../../components/Shared/CircularBadge";
import FloralMark from "../../components/Shared/FloralMark";
import { useAuth } from "../../context/AuthContext";
import { resendEmailCode } from '../../services/api';
import { images } from "../../config/site";
import "../../styles/admin.css";
import "../../styles/login.css";

export default function LoginAdmin({ audience = 'profissional', registering = false }) {
  const pageRef = useRef(null);
  const { isProfessional, isPatient, login, register, confirmEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const patient = audience === 'paciente';
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [time, setTime] = useState(Date.now());
  const resendSeconds = challenge ? Math.max(0, Math.ceil((challenge.reenviarEm - time) / 1000)) : 0;
  const expired = challenge && time >= challenge.expiraEm;
  const patientReturn = ['/minhas-consultas', '/minha-conta'].includes(location.state?.from) ? location.state.from : '/#agendamento';
  const destination = patient ? patientReturn : '/adm/agenda';

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const fitViewport = () => {
      pageRef.current?.style.setProperty('--login-height', `${viewport?.height ?? window.innerHeight}px`);
      pageRef.current?.style.setProperty('--login-offset', `${viewport?.offsetTop ?? 0}px`);
    };
    document.documentElement.classList.add('auth-screen');
    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('resize', fitViewport);
    return () => {
      document.documentElement.classList.remove('auth-screen');
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('resize', fitViewport);
    };
  }, []);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => setTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  useEffect(() => {
    document.title = `${registering ? 'Criar conta' : patient ? 'Entrar' : 'Acesso administrativo'} — Helena Martins`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    return () => { document.title = "Helena Martins — Psicologia & Escuta"; };
  }, [patient, registering]);

  if ((patient && isPatient) || (!patient && isProfessional)) return <Navigate to={destination} replace state={location.state} />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Informe um e-mail válido.'); return; }
    if (registering && (name.trim().length < 3 || !/^\d{10,13}$/.test(phone.replace(/\D/g, '')))) { setError('Informe seu nome completo e WhatsApp com DDD.'); return; }
    if (registering && (password.length < 8 || new TextEncoder().encode(password).length > 72)) {
      setError('Use uma senha com pelo menos 8 caracteres. Se ela for muito longa, reduza-a.');
      return;
    }
    setSubmitting(true);
    try {
      const data = registering
        ? await register({ nome: name.trim(), telefone: phone.replace(/\D/g, ''), email: email.trim(), senha: password })
        : await login({ email: email.trim(), senha: password }, audience);
      setChallenge(data);
      setPassword('');
      setTime(Date.now());
      setNotice('Código enviado. Confira também a pasta de spam.');
    } catch (requestError) {
      setError(requestError.status === 401 ? "E-mail ou senha não conferem. Revise os dados e tente novamente." : requestError.message || "Não foi possível entrar agora.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!/^\d{6}$/.test(code)) { setError('Informe o código de seis dígitos.'); return; }
    setError(''); setNotice(''); setSubmitting(true);
    try {
      await confirmEmail({ desafio: challenge.desafio, codigo: code }, audience);
      navigate(destination, { replace: true, state: location.state });
    } catch (requestError) { setError(requestError.message || 'Não foi possível confirmar o código.'); }
    finally { setSubmitting(false); }
  };

  const handleResend = async () => {
    if (submitting || resendSeconds > 0) return;
    setError(''); setNotice(''); setSubmitting(true);
    try {
      setChallenge(await resendEmailCode(challenge.desafio, audience));
      setCode(''); setTime(Date.now());
      setNotice('Novo código enviado. Use o código do e-mail mais recente.');
    } catch (requestError) { setError(requestError.message || 'Não foi possível reenviar o código.'); }
    finally { setSubmitting(false); }
  };

  return (
    <main ref={pageRef} className={`admin-page login-page${registering && !challenge ? ' is-registering' : ''}${challenge ? ' is-verifying' : ''}`}>
      <section className="login-visual" aria-hidden="true" style={{ "--login-image": `url("${images.hero.src}")` }}>
        <div className="login-visual-shade" />
        <div className="login-visual-copy"><span className="admin-kicker">{patient ? 'SEU ESPAÇO DE CUIDADO' : 'ESPAÇO PROFISSIONAL'}</span><p>{patient ? <>Um tempo para<br /><em>olhar para você.</em></> : <>Organizar também<br />é uma forma de <em>cuidar.</em></>}</p></div>
        <CircularBadge className="login-badge" />
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-top"><AdminBrand /><Link to="/" className="back-to-site">Voltar ao site <i className="bi bi-arrow-up-right" aria-hidden="true" /></Link></div>
        <div className="login-content">
          <nav className="login-audience" aria-label="Tipo de acesso">
            <Link to="/login" state={location.state} aria-current={patient ? 'page' : undefined}>Sou paciente</Link>
            <Link to="/adm/login" aria-current={!patient ? 'page' : undefined}>Sou psicóloga</Link>
          </nav>
          <div className="login-heading">
            <FloralMark /><p className="admin-kicker">{patient ? 'ÁREA DO PACIENTE' : 'ÁREA ADMINISTRATIVA'}</p>
            <h1 id="login-title">{challenge ? <>Confirme seu <em>e-mail.</em></> : registering ? <>Crie sua <em>conta.</em></> : patient ? <>Seu próximo <em>passo.</em></> : <>Bem-vinda <em>de volta.</em></>}</h1>
            <p>{challenge ? <>Código enviado para <strong className="verification-email">{challenge.email}</strong>. Válido por 10 minutos.</> : registering ? 'Preencha seus dados para agendar. Confirmaremos seu e-mail por código.' : patient ? 'Entre para agendar. Confirmaremos seu acesso com um código por e-mail.' : 'Acesse sua agenda com senha e um código de confirmação por e-mail.'}</p>
          </div>
          {challenge ? <form className="login-form" onSubmit={handleVerify} noValidate>
            {error && <div className="login-error" role="alert"><span>{error}</span></div>}
            {notice && <p className="verification-notice" role="status">{notice}</p>}
            <label className="admin-field"><span>Código de verificação</span><span className="field-control"><input className="verification-code" type="text" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={submitting} autoFocus aria-describedby="code-help" /></span></label>
            <p id="code-help" className="verification-notice">{expired ? 'Código expirado. Solicite um novo código abaixo.' : 'Após confirmar, seu e-mail ficará verificado para futuras notificações.'}</p>
            <button className="admin-button login-submit" type="submit" disabled={submitting || code.length !== 6 || expired}>{submitting ? 'Aguarde…' : 'Confirmar e entrar'}</button>
            <button className="verification-link" type="button" onClick={handleResend} disabled={submitting || resendSeconds > 0}>{resendSeconds > 0 ? `Reenviar código em ${resendSeconds}s` : 'Reenviar código'}</button>
            <button className="verification-link" type="button" disabled={submitting} onClick={() => {
              setChallenge(null); setCode(''); setError(''); setNotice('');
              if (registering) navigate('/login', { replace: true, state: location.state });
            }}>Voltar para o login</button>
          </form> : <>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="login-error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" /><span>{error}</span></div>}
            {registering && <>
              <label className="admin-field"><span>Nome completo</span><span className="field-control"><input type="text" name="nome" autoComplete="name" required minLength={3} maxLength={150} value={name} onChange={(event) => setName(event.target.value)} disabled={submitting} /></span></label>
              <label className="admin-field"><span>WhatsApp com DDD</span><span className="field-control"><input type="tel" name="telefone" autoComplete="tel" required maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} disabled={submitting} placeholder="(16) 99999-9999" /></span></label>
            </>}
            <label className="admin-field"><span>E-mail</span><span className="field-control"><i className="bi bi-envelope" aria-hidden="true" /><input type="email" name="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" inputMode="email" required maxLength={255} placeholder="seu@email.com" disabled={submitting} /></span></label>
            <div className="admin-field"><div className="password-label"><label htmlFor="admin-password">Senha</label>{registering && <span id="password-requirement">8+ caracteres</span>}</div><span className="field-control"><i className="bi bi-lock" aria-hidden="true" /><input id="admin-password" aria-describedby={registering ? "password-requirement" : undefined} type={showPassword ? "text" : "password"} name="senha" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} required placeholder={registering ? 'Crie sua senha' : 'Digite sua senha'} disabled={submitting} /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-pressed={showPassword} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}><i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" /></button></span></div>
            <button className="admin-button login-submit" type="submit" disabled={submitting || !email.trim() || !password}><span>{submitting ? (registering ? 'Criando conta…' : 'Entrando…') : registering ? 'Criar conta' : 'Entrar'}</span><i className="bi bi-arrow-up-right" aria-hidden="true" /></button>
          </form>
          {patient && <p className="login-switch">{registering ? 'Já tem uma conta?' : 'É sua primeira consulta?'} <Link to={registering ? '/login' : '/cadastro'} state={location.state}>{registering ? 'Entrar' : 'Criar conta'}</Link></p>}
          </>}
        </div>
        <p className="login-footer">Acesso reservado · Seus dados de login não são compartilhados.</p>
      </section>
    </main>
  );
}
