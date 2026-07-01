function Spinner({ label = "" }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4">
      <div
        className="size-9 shrink-0 rounded-full border-[3px] border-white/10 border-t-sky-400 motion-safe:animate-spin motion-reduce:animate-none motion-reduce:border-t-white/10"
        aria-hidden="true"
      />
      {label && <p className="text-slate-400">{label}</p>}
    </div>
  );
}

export default Spinner;
