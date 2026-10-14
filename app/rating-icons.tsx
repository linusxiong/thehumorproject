import type { SVGProps } from "react";

// Small face icons for the Still funny / Not funny buttons; they inherit the button's text color.
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function LaughIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M7.5 9.5q1.5-1.6 3 0M13.5 9.5q1.5-1.6 3 0" />
      <path d="M7 13.5h10a5 5 0 0 1-10 0Z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

export function MehIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8.5 9.5h.01M15.5 9.5h.01" strokeWidth="3" />
      <path d="M8.5 15.5q3.5-1.6 7 0.6" />
    </svg>
  );
}
