import { connection } from "next/server";

export default async function Home() {
  await connection();
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-semibold">Snag</h1>
    </main>
  );
}
