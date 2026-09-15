import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition duration-300 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9854f] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-stone-950 text-white shadow-[0_12px_30px_rgba(20,18,15,.16)] hover:bg-[#6f5635]",
        champagne: "bg-[#a9854f] text-white shadow-[0_12px_30px_rgba(112,83,39,.2)] hover:bg-[#826538]",
        outline: "border border-stone-900/15 bg-white/55 text-stone-900 hover:border-[#a9854f]/55 hover:bg-white",
        ghost: "text-stone-700 hover:bg-stone-900/5 hover:text-stone-950",
        danger: "bg-red-900 text-white hover:bg-red-800",
      },
      size: {
        default: "min-h-12 px-5",
        lg: "min-h-14 px-7 text-base",
        sm: "min-h-10 px-4 text-xs",
        icon: "size-12 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export { buttonVariants };
