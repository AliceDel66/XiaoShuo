import { useState, useEffect, useCallback } from "react";

interface AuthorizationCodeInfo {
  id: string;
  codePrefix: string;
  label: string;
  customerName: string;
  expiresAt: string;
  boundHardwareId: string;
  boundDeviceName: string;
  activatedAt: string;
  firstVerifiedAt: string;
  lastVerifiedAt: string;
  verifyCount: number;
  lastClientVersion: string;
  isFirstActivation: boolean;
}

interface AuthResult {
  token: string;
  authorizationCode: AuthorizationCodeInfo;
}

const ERROR_MESSAGES: Record<string, string> = {
  AUTHORIZATION_CODE_NOT_FOUND: "激活码不存在，请检查输入是否正确",
  AUTHORIZATION_CODE_REVOKED: "激活码已被撤销，请联系管理员",
  AUTHORIZATION_CODE_EXPIRED: "激活码已过期，请联系管理员续期",
  HWID_MISMATCH: "激活码已绑定到其他设备，一码一机不可更换",
  VALIDATION_ERROR: "请求参数不合法，请检查输入"
};

function getHardwareId(): string {
  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset()
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return "HWID-" + Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows 设备";
  if (ua.includes("Mac")) return "Mac 设备";
  if (ua.includes("Linux")) return "Linux 设备";
  return "未知设备";
}

const AUTH_STORAGE_KEY = "fanqie_auth_token";
const AUTH_CODE_KEY = "fanqie_auth_code_info";

export function getStoredAuth(): { token: string; codeInfo: AuthorizationCodeInfo } | null {
  try {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    const codeInfoRaw = localStorage.getItem(AUTH_CODE_KEY);
    if (token && codeInfoRaw) {
      return { token, codeInfo: JSON.parse(codeInfoRaw) };
    }
  } catch {
    // ignore
  }
  return null;
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(AUTH_CODE_KEY);
}

export function AuthPage({ onAuthorized }: { onAuthorized: (result: AuthResult) => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hwid] = useState(getHardwareId);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      onAuthorized({ token: stored.token, authorizationCode: stored.codeInfo });
    }
  }, [onAuthorized]);

  const handleSubmit = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("请输入激活码");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authBridge = (window as unknown as { authBridge: { login: (p: Record<string, string>) => Promise<{ status: number; body: unknown }> } }).authBridge;
      const { status, body: data } = await authBridge.login({
        code: trimmed,
        hwid,
        deviceName: getDeviceName(),
        clientVersion: "0.1.0"
      }) as { status: number; body: Record<string, unknown> };

      if (status !== 200 || !(data as Record<string, unknown>).success) {
        const err = data.error as Record<string, unknown> | undefined;
        const errorCode = (err?.code ?? (data as Record<string, unknown>).code ?? "") as string;
        const message = ERROR_MESSAGES[errorCode] ?? (err?.message as string) ?? (data as Record<string, unknown>).message ?? "激活失败，请稍后重试";
        setError(message as string);
        return;
      }

      const payload = data.data as Record<string, unknown>;
      const result: AuthResult = {
        token: payload.token as string,
        authorizationCode: payload.authorizationCode as AuthorizationCodeInfo
      };

      localStorage.setItem(AUTH_STORAGE_KEY, result.token);
      localStorage.setItem(AUTH_CODE_KEY, JSON.stringify(result.authorizationCode));

      onAuthorized(result);
    } catch (err) {
      setError(err instanceof Error ? `网络错误：${err.message}` : "网络连接失败，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }, [code, hwid, onAuthorized]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#090b11] text-slate-200">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-white/8 bg-[#141722]/95 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-cyan-400 to-sky-600 text-2xl font-bold text-slate-950 shadow-[0_12px_40px_rgba(14,165,233,0.35)]">
              N
            </div>
            <h1 className="text-xl font-semibold text-white">番茄作家助手</h1>
            <p className="mt-2 text-sm text-slate-400">请输入激活码以开始使用</p>
          </div>

          {/* Error */}
          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {/* Code input */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-slate-400">激活码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  void handleSubmit();
                }
              }}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoFocus
              className="w-full rounded-2xl border border-white/8 bg-[#0d1018] px-4 py-3 text-center text-lg tracking-widest text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60"
            />
          </div>

          {/* HWID display */}
          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium text-slate-400">机器码（自动获取）</label>
            <div className="rounded-2xl border border-white/6 bg-[#0d1018] px-4 py-2.5 text-center font-mono text-xs text-slate-500">
              {hwid}
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={loading || !code.trim()}
            onClick={() => void handleSubmit()}
            className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {loading ? "验证中..." : "激活"}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            一码一机 · 激活后绑定当前设备
          </p>
        </div>
      </div>
    </div>
  );
}
