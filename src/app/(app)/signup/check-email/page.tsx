import Link from "next/link";

export const dynamic = "force-dynamic";

/** Confirmation screen shown after signup: the verification email is on its way. */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-900 to-primary text-white">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="card bg-white p-8 text-slate-900 shadow-2xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <i className="fa-solid fa-envelope-circle-check text-2xl" />
            </div>
            <h1 className="mt-4 text-xl font-bold">Check your inbox</h1>
            <p className="mt-2 text-sm text-slate-600">
              We sent a verification link to
              {email ? (
                <>
                  {" "}
                  <span className="font-semibold text-slate-900">{email}</span>
                </>
              ) : (
                " your email"
              )}
              . Click it to activate your account — then you can log in.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              The link expires in 48 hours. Didn&apos;t get it? Check your spam folder.
            </p>
            <Link href="/login" className="btn-primary mt-6 w-full justify-center">
              <i className="fa-solid fa-arrow-left" /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
