type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

const base =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[15px] font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-soft hover:bg-accent-strong dark:text-[#111113]",
  secondary: "border border-line bg-surface text-ink shadow-soft hover:bg-canvas",
  ghost: "text-body hover:bg-line-soft hover:text-ink",
  danger: "text-danger hover:bg-danger/10",
}

const buttonClass = (variant: ButtonVariant = "secondary", extra = "") => `${base} ${variants[variant]} ${extra}`

export { buttonClass, type ButtonVariant }
