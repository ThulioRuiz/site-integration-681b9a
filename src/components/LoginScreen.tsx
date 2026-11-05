import { useState, type FormEvent } from "react";
import { KeyRound, LogIn, Mail, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AuthError,
  MissingIdentityError,
  acceptInvite,
  login,
  requestPasswordRecovery,
  signup,
  updateUser,
} from "@netlify/identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIdentity } from "@/lib/identity";
import { cn } from "@/lib/utils";

type Mode = "entrar" | "criar" | "recuperar";

function authMessage(e: unknown) {
  if (e instanceof MissingIdentityError) return "O login ainda não está ativo neste site.";
  if (e instanceof AuthError) {
    if (e.status === 401) return "E-mail ou senha incorretos (ou e-mail ainda não confirmado).";
    if (e.status === 403) return "Novos cadastros estão fechados. Peça um convite.";
    if (e.status === 422) return "Confira o e-mail e use uma senha com pelo menos 6 caracteres.";
    if (e.status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    return e.message;
  }
  return "Não foi possível continuar. Tente novamente.";
}

export function LoginScreen() {
  const { callback, clearCallback } = useIdentity();
  const [mode, setMode] = useState<Mode>("entrar");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // Link de convite: definir senha
  if (callback?.type === "invite" && callback.token) {
    const token = callback.token;
    return (
      <Frame>
        <h2 className="text-4xl font-bold uppercase">Aceitar convite</h2>
        <p className="text-muted-foreground">Crie uma senha para entrar no Quartel.</p>
        <PasswordForm
          label="Criar senha"
          onSubmit={async (pw) => {
            await acceptInvite(token, pw);
            clearCallback();
            toast.success("Conta pronta. Bem-vindo ao Quartel!");
          }}
        />
      </Frame>
    );
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    const name = String(f.get("name") ?? "").trim();
    setPending(true);
    setError(null);
    try {
      if (mode === "entrar") {
        await login(email, password);
        toast.success("Bem-vindo de volta!");
      } else if (mode === "criar") {
        const u = await signup(email, password, { full_name: name });
        if (!u.emailVerified) setSent(`Enviamos um link de confirmação para ${email}. Confirme e depois entre.`);
        else toast.success("Conta criada!");
      } else {
        await requestPasswordRecovery(email);
        setSent(`Se ${email} tiver conta, você receberá um link para redefinir a senha.`);
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Frame>
      <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/60 p-1">
        {(
          [
            ["entrar", "Entrar", LogIn],
            ["criar", "Criar conta", UserPlus],
            ["recuperar", "Esqueci", KeyRound],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setSent(null);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              mode === m ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <h2 className="text-4xl font-bold uppercase">
        {mode === "entrar" ? "Apresente-se, recruta" : mode === "criar" ? "Alistamento" : "Recuperar senha"}
      </h2>

      {sent ? (
        <div className="flex gap-3 rounded-xl border bg-card p-4 shadow-card">
          <Mail className="mt-0.5 size-5 shrink-0 text-brass" />
          <p className="text-sm">{sent}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={pending} className="space-y-4">
            {mode === "criar" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome ou apelido (aparece no ranking)</Label>
                <Input id="name" name="name" autoComplete="nickname" required maxLength={40} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {mode !== "recuperar" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={6}
                  autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                  required
                />
              </div>
            )}
            <Button type="submit" size="lg" className="w-full">
              {pending
                ? "Aguarde…"
                : mode === "entrar"
                  ? "Entrar no Quartel"
                  : mode === "criar"
                    ? "Criar minha conta"
                    : "Enviar link"}
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </Frame>
  );
}

/** Tela para definir nova senha depois do link de recuperação. */
export function RecoveryScreen() {
  const { clearCallback } = useIdentity();
  return (
    <Frame>
      <h2 className="text-4xl font-bold uppercase">Nova senha</h2>
      <p className="text-muted-foreground">Defina uma nova senha para sua conta.</p>
      <PasswordForm
        label="Salvar nova senha"
        onSubmit={async (pw) => {
          await updateUser({ password: pw });
          clearCallback();
          toast.success("Senha atualizada.");
        }}
      />
    </Frame>
  );
}

function PasswordForm({ label, onSubmit }: { label: string; onSubmit: (pw: string) => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const pw = String(new FormData(e.currentTarget).get("password") ?? "");
        setPending(true);
        setError(null);
        try {
          await onSubmit(pw);
        } catch (err) {
          setError(authMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">Senha</Label>
          <Input id="new-password" name="password" type="password" minLength={6} autoComplete="new-password" required />
        </div>
        <Button type="submit" size="lg" className="w-full">
          {pending ? "Aguarde…" : label}
        </Button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.2fr]">
      <aside className="bg-field relative hidden flex-col justify-between p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-brass text-brass-foreground">
            <Shield className="size-6" />
          </div>
          <span className="font-display text-2xl font-bold uppercase tracking-wider">Quartel de Estudos</span>
        </div>
        <div>
          <p className="eyebrow text-brass">Missão</p>
          <h1 className="mt-2 text-6xl font-bold uppercase leading-[0.95]">
            Disciplina hoje,
            <br />
            aprovação amanhã.
          </h1>
          <p className="mt-6 max-w-md text-primary-foreground/80">
            Ciclos, calendário, matérias com subtópicos, biblioteca de PDFs e ranking entre recrutas — tudo em um só
            quartel para ITA, IME, EFOMM e EsPCEx.
          </p>
        </div>
        <p className="eyebrow text-primary-foreground/60">Acesso restrito a recrutas cadastrados</p>
      </aside>
      <main className="flex items-center justify-center p-5 md:p-10">
        <div className="w-full max-w-md space-y-6 animate-rise">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-5" />
            </div>
            <span className="font-display text-xl font-bold uppercase tracking-wider">Quartel de Estudos</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
