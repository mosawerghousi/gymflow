"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Delete, Loader2 } from "lucide-react";

import type { CheckInResultDto } from "@/application/dto/checkin.dto";
import { GymFlowLogo } from "@/presentation/components/brand/logo";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { cn } from "@/presentation/lib/utils";
import { apiErrorMessage } from "@/presentation/store/api/base-api";
import { useKioskCheckInMutation } from "@/presentation/store/api/checkins-api";
import { useAppDispatch, useAppSelector } from "@/presentation/store/hooks";
import {
  codeSet,
  devicePaired,
  deviceUnpaired,
  digitPressed,
  digitRemoved,
  kioskCheckInFailed,
  kioskCheckInSucceeded,
  kioskReset,
  scannerActivated,
} from "@/presentation/store/kiosk-slice";

const TOKEN_STORAGE_KEY = "gymflow.kiosk.token";
const RESULT_TIMEOUT_MS = 5_000;
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Fullscreen self-service check-in.
 *
 * The screen is unattended, so it authenticates with a device token rather than
 * a user session and can only ever create a check-in. QR scanning uses the
 * browser's built-in BarcodeDetector when available; the keypad always works.
 */
export function KioskScreen({ gymName }: { gymName: string }) {
  const dispatch = useAppDispatch();
  const { stage, deviceToken, code, result, error, scannerActive } = useAppSelector(
    (state) => state.kiosk,
  );

  const [checkIn, { isLoading }] = useKioskCheckInMutation();
  const [tokenInput, setTokenInput] = useState("");

  // Pairing survives a reload — a kiosk is set up once and left alone.
  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) dispatch(devicePaired(stored));
  }, [dispatch]);

  const submit = useCallback(
    async (memberCode: string, method: "code" | "qr") => {
      if (!deviceToken || memberCode.trim().length === 0) return;

      try {
        const outcome = await checkIn({ memberCode, method, deviceToken }).unwrap();
        dispatch(kioskCheckInSucceeded(outcome));
      } catch (caught) {
        dispatch(kioskCheckInFailed(apiErrorMessage(caught, "We could not check you in.")));
      }
    },
    [checkIn, deviceToken, dispatch],
  );

  // Clear the result screen so the next person sees a fresh keypad.
  useEffect(() => {
    if (stage !== "result") return;

    const timer = setTimeout(() => dispatch(kioskReset()), RESULT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stage, dispatch]);

  // Physical barcode scanners type the code and press Enter.
  useEffect(() => {
    if (stage === "pairing") return;

    function onKeyDown(event: KeyboardEvent) {
      if (/^[0-9]$/.test(event.key)) dispatch(digitPressed(event.key));
      else if (event.key === "Backspace") dispatch(digitRemoved());
      else if (event.key === "Enter" && code.length > 0) void submit(code, "code");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage, code, dispatch, submit]);

  if (stage === "pairing") {
    return (
      <PairingScreen
        value={tokenInput}
        onChange={setTokenInput}
        onSubmit={() => {
          const trimmed = tokenInput.trim();
          if (!trimmed) return;
          window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
          dispatch(devicePaired(trimmed));
        }}
      />
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-56 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl"
      />

      <header className="absolute top-6 left-1/2 -translate-x-1/2">
        <GymFlowLogo iconClassName="size-9" wordmarkClassName="text-2xl" />
      </header>

      <button
        type="button"
        onClick={() => {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          dispatch(deviceUnpaired());
        }}
        className="absolute top-6 right-6 text-xs text-muted-foreground/50 hover:text-muted-foreground"
      >
        Unpair
      </button>

      {stage === "result" ? (
        <ResultPanel
          result={result}
          error={error}
          onDismiss={() => dispatch(kioskReset())}
          gymName={gymName}
        />
      ) : (
        <div className="relative z-10 w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to {gymName}</h1>
          <p className="mt-2 text-muted-foreground">
            Enter your member code or scan the QR on your card.
          </p>

          <div
            className="mx-auto mt-8 flex h-20 items-center justify-center gap-2"
            aria-live="polite"
            aria-label={`Code entered: ${code || "none"}`}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl border-2 text-2xl font-semibold tabular-nums transition-colors",
                  code[index]
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground/30",
                )}
              >
                {code[index] ?? "·"}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-6 grid w-64 grid-cols-3 gap-3">
            {KEYPAD.map((digit) => (
              <KeypadButton key={digit} onClick={() => dispatch(digitPressed(digit))}>
                {digit}
              </KeypadButton>
            ))}

            <KeypadButton
              onClick={() => dispatch(scannerActivated(!scannerActive))}
              aria-label={scannerActive ? "Stop scanning" : "Scan QR code"}
            >
              {scannerActive ? (
                <CameraOff className="size-5" />
              ) : (
                <Camera className="size-5" />
              )}
            </KeypadButton>

            <KeypadButton onClick={() => dispatch(digitPressed("0"))}>0</KeypadButton>

            <KeypadButton onClick={() => dispatch(digitRemoved())} aria-label="Delete">
              <Delete className="size-5" />
            </KeypadButton>
          </div>

          <Button
            size="lg"
            className="mt-6 h-14 w-64 text-base"
            disabled={code.length === 0 || isLoading}
            onClick={() => void submit(code, "code")}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : null}
            Check in
          </Button>

          {scannerActive ? (
            <QrScanner
              onDetected={(value) => {
                dispatch(codeSet(value.replace(/\D/g, "").slice(-6)));
                void submit(value, "qr");
              }}
              onUnsupported={() => {
                dispatch(scannerActivated(false));
                dispatch(
                  kioskCheckInFailed(
                    "This browser cannot scan QR codes. Type your member code instead.",
                  ),
                );
              }}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}

function KeypadButton({
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-16 items-center justify-center rounded-xl border border-border bg-card text-xl font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-95"
      {...rest}
    >
      {children}
    </button>
  );
}

function ResultPanel({
  result,
  error,
  onDismiss,
  gymName,
}: {
  result: CheckInResultDto | null;
  error: string | null;
  onDismiss: () => void;
  gymName: string;
}) {
  if (error) {
    return (
      <div className="relative z-10 max-w-md text-center">
        <AlertTriangle className="mx-auto size-16 text-amber-400" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Please see the front desk</h1>
        <p className="mt-3 text-lg text-muted-foreground">{error}</p>
        <Button size="lg" variant="outline" className="mt-8" onClick={onDismiss}>
          Try again
        </Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="relative z-10 max-w-md text-center">
      <CheckCircle2 className="mx-auto size-16 text-primary" />
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">
        {result.outcome === "already_inside"
          ? `You are already in, ${firstName(result.member.fullName)}`
          : `You're in, ${firstName(result.member.fullName)}`}
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Have a great session at {gymName}.
      </p>

      {result.warnings.length > 0 ? (
        <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/8 px-4 py-2.5 text-sm text-amber-400">
          {result.warnings.join(" ")}
        </p>
      ) : null}

      <Button size="lg" variant="outline" className="mt-8" onClick={onDismiss}>
        Done
      </Button>
    </div>
  );
}

function PairingScreen({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form
        className="w-full max-w-sm space-y-5 text-center"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <GymFlowLogo className="justify-center" iconClassName="size-10" wordmarkClassName="text-2xl" />

        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pair this kiosk</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Paste the device token from Settings → Kiosks. It is stored on this device only.
          </p>
        </div>

        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="gfk_…"
          aria-label="Kiosk device token"
          className="text-center font-mono"
        />

        <Button type="submit" size="lg" className="w-full" disabled={!value.trim()}>
          Pair kiosk
        </Button>
      </form>
    </main>
  );
}

/**
 * Camera scanning via the platform BarcodeDetector.
 *
 * No third-party decoder: the browsers that run an unattended kiosk (Chrome on
 * Android/ChromeOS, Edge) ship it natively, and the keypad covers everything
 * else — which is why an unsupported browser falls back instead of failing.
 */
function QrScanner({
  onDetected,
  onUnsupported,
}: {
  onDetected: (value: string) => void;
  onUnsupported: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Point the QR code at the camera…");

  useEffect(() => {
    const DetectorCtor = (
      window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => {
        detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
      } }
    ).BarcodeDetector;

    if (!DetectorCtor || !navigator.mediaDevices?.getUserMedia) {
      onUnsupported();
      return;
    }

    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;

    const detector = new DetectorCtor({ formats: ["qr_code"] });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled || !videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          if (cancelled || !videoRef.current) return;

          try {
            const codes = await detector.detect(videoRef.current);
            const first = codes[0];

            if (first?.rawValue) {
              onDetected(first.rawValue);
              return;
            }
          } catch {
            // A dropped frame is normal; keep scanning.
          }

          frame = requestAnimationFrame(() => void tick());
        };

        frame = requestAnimationFrame(() => void tick());
      } catch {
        setMessage("Camera access was declined. Use the keypad instead.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected, onUnsupported]);

  return (
    <div className="mt-6">
      <video
        ref={videoRef}
        muted
        playsInline
        className="mx-auto aspect-square w-64 rounded-2xl border-2 border-primary/40 object-cover"
      />
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}
