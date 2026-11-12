import Link from "next/link";
import { getImageProps } from "next/image";

export function Logo(): React.ReactElement {
  const { props } = getImageProps({ src: "/logo.svg", alt: "Snag", width: 96, height: 32, loading: "eager" });
  return <Link href="/" className="inline-flex min-h-11 items-center"><img {...props} alt="Snag" style={undefined} /></Link>;
}
