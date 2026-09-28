'use client';

import { useEffect, useState } from 'react';
import InvestorSidebar from '@/components/InvestorSidebar';
import { Icon } from '@iconify/react';

type Application = { id: number; status: string; documentPath: string; reviewNote: string | null };

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function KycPage() {
  const [idFile, setIdFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/kyc', { cache: 'no-store' });
      if (response.ok) {
        const rows = await response.json();
        setApplication(rows[0] ?? null);
      }
    } catch {
      setMessage('Unable to load verification status. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function chooseFile(file: File | null, setter: (value: File | null) => void) {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setMessage('Documents must be JPG, PNG, WebP, or PDF.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage('Each document must be 10 MB or smaller.');
      return;
    }
    setter(file);
    setMessage('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!idFile || !addressFile || submitting) return;
    setSubmitting(true);
    setMessage('Uploading documents…');

    try {
      const paths: string[] = [];
      for (const file of [idFile, addressFile]) {
        const form = new FormData();
        form.append('file', file);
        form.append('purpose', 'kyc');
        const upload = await fetch('/api/uploads', { method: 'POST', body: form });
        const data = await upload.json().catch(() => ({}));
        if (!upload.ok || !data.path || data.bucket !== 'quantovest-media') {
          setMessage(data.error ?? 'Document upload failed. Please try again.');
          return;
        }
        paths.push(data.path);
      }

      const response = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentPath: JSON.stringify({
            bucket: 'quantovest-media',
            idDocument: paths[0],
            proofOfAddress: paths[1],
          }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      setMessage(response.ok ? 'Documents submitted for review.' : data.error ?? 'KYC submission failed.');
      if (response.ok) await load();
    } catch {
      setMessage('Unable to submit documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F11] text-[#F3F7F4] flex flex-col md:flex-row font-sans">
      <InvestorSidebar />
      <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto pb-24 md:pb-8">
        <div className="border-b border-[#263437] pb-6">
          <h1 className="text-2xl font-normal">Identity Verification (KYC)</h1>
          <p className="mt-1 text-xs text-[#93A09A]">Upload your identity documents for manual review.</p>
        </div>
        <div className="max-w-2xl rounded-2xl border border-[#263437] bg-[#141C1F] p-6 sm:p-8 space-y-6">
          {message && <div role="status" aria-live="polite" className="rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/10 p-4 text-xs text-[#86EFAC]">{message}</div>}
          <div className="flex items-center justify-between rounded-xl border border-[#263437] bg-[#0A0F11] p-4 text-xs">
            <span className="text-[#93A09A]">Verification status</span>
            <span className="rounded-full bg-amber-500/20 px-3 py-1 font-mono text-amber-300">{loading ? 'LOADING' : (application?.status ?? 'NOT SUBMITTED').toUpperCase()}</span>
          </div>
          {application?.status === 'approved' ? (
            <div className="py-8 text-center">
              <Icon icon="solar:shield-check-bold" className="mx-auto h-12 w-12 text-[#22C55E]" />
              <h2 className="mt-3 text-lg">Identity verified</h2>
              <p className="mt-2 text-xs text-[#93A09A]">Your account is approved for verified investor workflows.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <label className="block text-xs text-[#93A09A]">Government ID
                <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => chooseFile(event.target.files?.[0] ?? null, setIdFile)} className="mt-2 min-h-11 w-full text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded" aria-describedby={idFile ? undefined : 'kyc-id-hint'} />
                {!idFile && <span id="kyc-id-hint" className="mt-1 block text-[10px] text-[#93A09A]">JPG, PNG, WebP, or PDF up to 10 MB.</span>}
              </label>
              <label className="block text-xs text-[#93A09A]">Proof of address
                <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event => chooseFile(event.target.files?.[0] ?? null, setAddressFile)} className="mt-2 min-h-11 w-full text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded" />
              </label>
              <button disabled={!idFile || !addressFile || submitting} className="min-h-11 w-full rounded-full bg-[#22C55E] py-3.5 text-xs font-semibold text-[#07110B] disabled:opacity-40 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F11]">
                {submitting ? 'Uploading…' : 'Submit KYC verification'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
