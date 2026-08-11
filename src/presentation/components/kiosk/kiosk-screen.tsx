"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, Check, Delete, Loader2 } from "lucide-react";

import type { CheckInResultDto } from "@/application/dto/checkin.dto";
import { GymFlowIcon, GymFlowLogo } from "@/presentation/components/brand/logo";
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
 * Everything here is sized to be read from a metre and a half away and hit with
 * a thumb: 72px result type, 96px keypad targets. The screen is unattended, so
 * it authenticates with a device token rather than a session and can only ever
 * create a check-in.
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

  // Clear the result so the next person meets a fresh keypad.
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
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-64 left-1/2 size-[46rem] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-3xl"
      />

      <header className="absolute top-8 left-1/2 -translate-x-1/2">
        <GymFlowLogo iconClassName="size-8" wordmarkClassName="text-xl" />
      </header>

      <button
        type="button"
        onClick={() => {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          dispatch(deviceUnpaired());
        }}
        className="absolute top-8 right-8 text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground"
      >
        Unpair
      </button>

      {stage === "result" ? (
        <ResultPanel
          result={result}
          error={error}
          gymName={gymName}
          onDismiss={() => dispatch(kioskReset())}
        />
      ) : (
        <div className="relative z-10 w-full max-w-md text-center">
          {/* Idle: the mark breathes so the screen reads as awake, not frozen. */}
          {stage === "idle" ? (
            <GymFlowIcon className="mx-auto mb-6 size-14 animate-[var(--animate-breathe)]" />
          ) : (
            <div className="mb-6 h-14" />
          )}

          <h1 className="text-xl font-semibold tracking-tight">Welcome to {gymName}</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Enter your member code, or scan the QR on your card.
          </p>

          <div
            className="mx-auto mt-9 flex h-20 items-center justify-center gap-2.5"
            aria-live="polite"
            aria-label={`Code entered: ${code || "none"}`}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                data-numeric
                className={cn(
                  "flex size-14 items-center justify-center rounded-lg border-2 text-xl font-semibold transition-colors duration-150",
                  code[index]
                    ? "border-primary bg-brand-subtle text-primary"
                    : "border-border text-muted-foreground/30",
                )}
              >
                {code[index] ?? "·"}
              </span>
            ))}
          </div>

          <div className="mx-auto mt-8 grid w-80 grid-cols-3 gap-3">
            {KEYPAD.map((digit) => (
              <KeypadButton key={digit} onClick={() => dispatch(digitPressed(digit))}>
                {digit}
              </KeypadButton>
            ))}

            <KeypadButton
              muted
              onClick={() => dispatch(scannerActivated(!scannerActive))}
              aria-label={scannerActive ? "Stop scanning" : "Scan QR code"}
            >
              {scannerActive ? <CameraOff className="size-6" /> : <Camera className="size-6" />}
            </KeypadButton>

            <KeypadButton onClick={() => dispatch(digitPressed("0"))}>0</KeypadButton>

            <KeypadButton muted onClick={() => dispatch(digitRemoved())} aria-label="Delete">
              <Delete className="size-6" />
            </KeypadButton>
          </div>

          <Button
            size="xl"
            className="mt-7 h-16 w-80 text-base"
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
                    "This device cannot scan QR codes. Type your member code instead.",
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
  muted = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { muted?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-20 items-center justify-center rounded-xl border text-xl font-medium",
        "transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-out-quick)]",
        "hover:border-primary/50 hover:bg-surface-2 active:scale-95",
        muted
          ? "border-border bg-transparent text-muted-foreground"
          : "border-border bg-surface-1 text-foreground",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function ResultPanel({
  result,
  error,
  gymName,
  onDismiss,
}: {
  result: CheckInResultDto | null;
  error: string | null;
  gymName: string;
  onDismiss: () => void;
}) {
  if (error) {
    return (
      <div className="relative z-10 max-w-lg text-center">
        <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-danger-subtle">
          <AlertTriangle className="size-10 text-danger" />
        </span>
        <h1 className="mt-7 text-2xl font-semibold tracking-tight">
          Please see the front desk
        </h1>
        <p className="mt-3 text-base text-muted-foreground">{error}</p>
        <Button size="xl" variant="secondary" className="mt-9" onClick={onDismiss}>
          Try again
        </Button>
      </div>
    );
  }

  if (!result) return null;

  const firstName = result.member.fullName.split(" ")[0] ?? result.member.fullName;

  return (
    <div className="relative z-10 max-w-2xl animate-[var(--animate-check-in)] text-center">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-success text-success-foreground">
        <Check className="size-11" strokeWidth={2.5} />
      </span>

      {/* The one 72px moment in the app. */}
      <h1 className="mt-8 text-4xl font-semibold tracking-tight text-balance">
        {result.outcome === "already_inside" ? (
          <>
            You&apos;re already in,
            <br />
            <span className="text-primary">{firstName}</span>
          </>
        ) : (
          <>
            Welcome back,
            <br />
            <span className="text-primary">{firstName}</span>
          </>
        )}
      </h1>

      <p className="mt-5 text-lg text-muted-foreground">
        Have a great session at {gymName}.
      </p>

      {result.warnings.length > 0 ? (
        <p className="mx-auto mt-7 max-w-md rounded-lg border border-warning/40 bg-warning-subtle px-4 py-3 text-base text-warning">
          {result.warnings.join(" ")}
        </p>
      ) : null}

      <Button size="lg" variant="ghost" className="mt-9" onClick={onDismiss}>
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
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <form
        className="w-full max-w-sm space-y-6 text-center"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <GymFlowLogo
          className="justify-center"
          iconClassName="size-9"
          wordmarkClassName="text-xl"
        />

        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold tracking-tight">Pair this kiosk</h1>
          <p className="text-sm text-muted-foreground">
            Paste the device token from Settings → Kiosks. It is stored on this device only.
          </p>
        </div>

        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="gfk_…"
          aria-label="Kiosk device token"
          className="h-12 text-center font-mono"
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
 * No third-party decoder: the browsers that run an unattended kiosk ship it
 * natively, and the keypad covers everything else — which is why an unsupported
 * browser falls back rather than failing.
 */
function QrScanner({
  onDetected,
  onUnsupported,
}: {
  onDetected: (value: string) => void;
  onUnsupported: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("Hold the QR code up to the camera…");

  useEffect(() => {
    const DetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
        };
      }
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
    <div className="mt-8">
      <video
        ref={videoRef}
        muted
        playsInline
        className="mx-auto aspect-square w-72 rounded-2xl border-2 border-primary/50 object-cover"
      />
      <p className="mt-3 text-base text-muted-foreground">{message}</p>
    </div>
  );
}
