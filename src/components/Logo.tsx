import Link from "next/link";
import Image from "next/image";

export function Logo(): React.ReactElement { return <Link href="/" className="inline-flex min-h-11 items-center"><Image src="/logo.svg" alt="Snag" width={96} height={32} /></Link>; }
