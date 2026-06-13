import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useGenerateCopy, useRegenerateCopy, useUploadCreative, useCreateAd, useSubmitAd } from '../hooks';
import { AdPreview, Spinner } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { CampaignObjective, BudgetType, CtaType, Placement } from '@shared/types';
import { getErrorMessage } from '../lib/api';
import clsx from 'clsx';
import { UploadCloud, RefreshCw, AlertCircle, X, Plus, Film } from 'lucide-react';
import { MapLocationPicker, PinnedLocation } from '../components/ui/MapLocationPicker';

interface UploadedCreative {
  id: string; url: string; type: 'IMAGE' | 'VIDEO'; name: string; copyIndex: number;
}
interface AdCopy { primaryText: string; headline: string; description: string; }

function Steps({ current }: { current: number }) {
  const steps = ['Ad details', 'AI copy', 'Campaign setup', 'Review & submit'];
  return (
    <div className="flex items-center gap-0 mb-6 md:mb-8">
      {steps.map((label, i) => {
        const n = i + 1; const done = n < current; const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className={clsx('flex items-center gap-2', active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-gray-400')}>
              <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border-2', {
                'border-indigo-600 bg-indigo-600 text-white': active,
                'border-emerald-500 bg-emerald-500 text-white': done,
                'border-gray-300 bg-white text-gray-400': !active && !done,
              })}>{done ? '✓' : n}</div>
              <span className="hidden sm:inline text-xs font-medium">{label}</span>
            </div>
            {i < steps.length - 1 && <div className={clsx('flex-1 h-px mx-3 min-w-8', done ? 'bg-emerald-300' : 'bg-gray-200')} />}
          </div>
        );
      })}
    </div>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; }) {
  const [input, setInput] = useState('');
  const add = () => { const v = input.trim(); if (v && !value.includes(v)) onChange([...value, v]); setInput(''); };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
            {tag}<button onClick={() => onChange(value.filter((t) => t !== tag))}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder ?? 'Type and press Enter'} />
        <button type="button" onClick={add} className="btn btn-sm">Add</button>
      </div>
    </div>
  );
}

export function CreateAdPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [adIds, setAdIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [creatives, setCreatives] = useState<UploadedCreative[]>([]);
  const [interests, setInterests] = useState(['Technology', 'Business']);
  const [locations, setLocations] = useState<string[]>(['United States']);
  const [pinnedLocations, setPinnedLocations] = useState<PinnedLocation[]>([]);
  const [selectedAdType, setSelectedAdType] = useState<CampaignObjective>(CampaignObjective.TRAFFIC);
  const [copyA, setCopyA] = useState<AdCopy>({ primaryText: '', headline: '', description: '' });
  const [copyB, setCopyB] = useState<AdCopy>({ primaryText: '', headline: '', description: '' });
  const [activeCopyTab, setActiveCopyTab] = useState<'A' | 'B'>('A');
  const [generatingB, setGeneratingB] = useState(false);
  const MAX_CREATIVES = 5;

  const { register, watch, setValue, getValues } = useForm({
    defaultValues: { url: '', cta: CtaType.LEARN_MORE, objective: CampaignObjective.TRAFFIC, budgetType: BudgetType.DAILY, budgetAmount: 25, ageMin: 18, ageMax: 65, placements: [Placement.AUTOMATIC] },
  });

  const generateCopy = useGenerateCopy();
  const regenerateCopy = useRegenerateCopy();
  const uploadCreative = useUploadCreative();
  const createAd = useCreateAd();
  const submitAd = useSubmitAd();
  const url = watch('url');
  const cta = watch('cta');

  const handleFileUpload = useCallback(async (file: File) => {
    if (creatives.length >= MAX_CREATIVES) { setError(`Maximum ${MAX_CREATIVES} creatives allowed`); return; }
    try {
      const result = await uploadCreative.mutateAsync(file);
      setCreatives(prev => [...prev, { id: `${Date.now()}`, url: result.url, type: result.type, name: file.name, copyIndex: prev.length % 2 }]);
    } catch (e) { setError(getErrorMessage(e)); }
  }, [creatives, uploadCreative]);

  const removeCreative = (id: string) => setCreatives(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, copyIndex: i % 2 })));
  const toggleCopyIndex = (id: string) => setCreatives(prev => prev.map(c => c.id === id ? { ...c, copyIndex: c.copyIndex === 0 ? 1 : 0 } : c));

  const handleGenerate = async () => {
    setError('');
    if (!url) { setError('Please enter a URL'); return; }
    setValue('objective', selectedAdType);
    try {
      const resultA = await generateCopy.mutateAsync({ url });
      setCopyA({ primaryText: resultA.copy.primaryText, headline: resultA.copy.headline, description: resultA.copy.description });
      setGeneratingB(true);
      const resultB = await regenerateCopy.mutateAsync({ url, existingCopy: { primaryText: resultA.copy.primaryText, headline: resultA.copy.headline, description: resultA.copy.description } });
      setCopyB({ primaryText: resultB.primaryText, headline: resultB.headline, description: resultB.description });
      setGeneratingB(false);
      setStep(2);
    } catch (e) { setGeneratingB(false); setError(getErrorMessage(e)); }
  };

  const handleRegenerate = async (which: 'A' | 'B') => {
    try {
      const existing = which === 'A' ? copyA : copyB;
      const copy = await regenerateCopy.mutateAsync({ url, existingCopy: existing });
      const newCopy = { primaryText: copy.primaryText, headline: copy.headline, description: copy.description };
      if (which === 'A') setCopyA(newCopy); else setCopyB(newCopy);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const handleSaveDraft = async () => {
    setError('');
    if (creatives.length === 0) { setError('Please upload at least one creative'); return; }
    const vals = getValues();
    const basePayload = {
      websiteUrl: vals.url, cta: vals.cta, objective: vals.objective,
      budgetType: vals.budgetType, budgetAmount: Number(vals.budgetAmount),
      ageMin: Number(vals.ageMin), ageMax: Number(vals.ageMax),
      locations: pinnedLocations.length > 0 ? pinnedLocations.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}+${p.radiusMiles}mi`) : locations,
      interests, placements: [vals.placements].flat(),
    };
    try {
      const ids: string[] = [];
      for (const creative of creatives) {
        const copy = creative.copyIndex === 0 ? copyA : copyB;
        const ad = await createAd.mutateAsync({ ...basePayload, primaryText: copy.primaryText, headline: copy.headline, description: copy.description, creativeUrl: creative.url, creativeType: creative.type });
        ids.push(ad.id);
      }
      setAdIds(ids);
      setStep(4);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const handleSubmit = async () => {
    if (!adIds.length) return;
    setError('');
    try {
      for (const id of adIds) await submitAd.mutateAsync(id);
      navigate('/ads');
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const vals = getValues();
  const isBulk = creatives.length > 1;

  return (
    <div>
      <PageHeader title="Create new ad" description="AI-powered ad creation in 4 steps" />
      <div className="p-4 md:p-6 max-w-5xl">
        <Steps current={step} />
        {error && <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Ad details</h3>
              <div>
                <label className="label">Ad type *</label>
                <select className="input" value={selectedAdType} onChange={(e) => setSelectedAdType(e.target.value as CampaignObjective)}>
                  <option value={CampaignObjective.TRAFFIC}>Traffic — Drive visitors to your website</option>
                  <option value={CampaignObjective.SALES}>Sales — Increase conversions and purchases</option>
                  <option value={CampaignObjective.AWARENESS}>Awareness — Grow brand recognition</option>
                </select>
              </div>
              <div>
                <label className="label">Website / event URL *</label>
                <input {...register('url')} type="url" className="input" placeholder="https://yourbusiness.com/product" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Upload creatives (up to {MAX_CREATIVES})</label>
                  <span className="text-xs text-gray-400">{creatives.length}/{MAX_CREATIVES}</span>
                </div>
                {creatives.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {creatives.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                          {c.type === 'IMAGE' ? <img src={c.url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film className="w-5 h-5 text-gray-400" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{c.name}</p>
                          <p className="text-xs text-gray-400">Ad {i + 1}</p>
                        </div>
                        <button type="button" onClick={() => toggleCopyIndex(c.id)}
                          className={clsx('px-2 py-1 rounded text-xs font-semibold border transition-colors', c.copyIndex === 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-violet-50 border-violet-200 text-violet-700')}>
                          Copy {c.copyIndex === 0 ? 'A' : 'B'}
                        </button>
                        <button type="button" onClick={() => removeCreative(c.id)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {creatives.length < MAX_CREATIVES && (
                  <label className={clsx('flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors', uploadCreative.isPending ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50')}>
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
                    {uploadCreative.isPending ? <><Spinner className="w-4 h-4" /><span className="text-sm text-indigo-600">Uploading…</span></> : <><Plus className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-500">{creatives.length === 0 ? 'Click to upload image or video' : 'Add another creative'}</span></>}
                  </label>
                )}
                {isBulk && <p className="text-xs text-gray-400 mt-2">💡 Click "Copy A/B" to reassign which copy a creative uses</p>}
              </div>
              <button className="btn btn-primary w-full justify-center" onClick={handleGenerate} disabled={generateCopy.isPending || generatingB}>
                {generateCopy.isPending || generatingB ? <><Spinner className="w-4 h-4" /> {generatingB ? 'Generating Copy B…' : 'Generating Copy A…'}</> : 'Generate AI copy →'}
              </button>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">How it works</h3>
              {[['Paste your URL', 'We extract event details and metadata'], ['Upload up to 5 creatives', 'Each becomes a separate ad under the same campaign'], ['2 AI copies generated', 'Copy A and B are distributed across your creatives'], ['Submit for review', 'Admin approves and all ads publish under one campaign']].map(([title, desc], i) => (
                <div key={i} className="flex gap-3 mb-4">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                  <div><p className="text-sm font-medium text-gray-900">{title}</p><p className="text-xs text-gray-500 mt-0.5">{desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['A', 'B'] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveCopyTab(tab)}
                  className={clsx('px-4 py-2 rounded-lg text-sm font-medium border transition-colors', activeCopyTab === tab ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
                  Copy {tab} <span className="ml-1 text-xs opacity-70">({creatives.filter(c => c.copyIndex === (tab === 'A' ? 0 : 1)).length} creative{creatives.filter(c => c.copyIndex === (tab === 'A' ? 0 : 1)).length !== 1 ? 's' : ''})</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Copy {activeCopyTab}</h3>
                  <button className="btn btn-sm gap-1" onClick={() => handleRegenerate(activeCopyTab)} disabled={regenerateCopy.isPending}>
                    <RefreshCw className={clsx('w-3 h-3', regenerateCopy.isPending && 'animate-spin')} /> Regenerate
                  </button>
                </div>
                {activeCopyTab === 'A' ? (
                  <>
                    <div><label className="label">Primary text</label><textarea className="input min-h-[100px]" rows={4} value={copyA.primaryText} onChange={(e) => setCopyA(p => ({ ...p, primaryText: e.target.value }))} /></div>
                    <div><label className="label">Headline</label><input className="input" value={copyA.headline} onChange={(e) => setCopyA(p => ({ ...p, headline: e.target.value }))} /></div>
                    <div><label className="label">Description</label><input className="input" value={copyA.description} onChange={(e) => setCopyA(p => ({ ...p, description: e.target.value }))} /></div>
                  </>
                ) : (
                  <>
                    <div><label className="label">Primary text</label><textarea className="input min-h-[100px]" rows={4} value={copyB.primaryText} onChange={(e) => setCopyB(p => ({ ...p, primaryText: e.target.value }))} /></div>
                    <div><label className="label">Headline</label><input className="input" value={copyB.headline} onChange={(e) => setCopyB(p => ({ ...p, headline: e.target.value }))} /></div>
                    <div><label className="label">Description</label><input className="input" value={copyB.description} onChange={(e) => setCopyB(p => ({ ...p, description: e.target.value }))} /></div>
                  </>
                )}
                <div><label className="label">Call to action (shared)</label>
                  <select {...register('cta')} className="input">{Object.values(CtaType).map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select>
                </div>
                <div className="flex justify-between pt-2">
                  <button className="btn btn-sm" onClick={() => setStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={() => setStep(3)}>Set up campaign →</button>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Preview — Copy {activeCopyTab}</h3>
                <AdPreview primaryText={activeCopyTab === 'A' ? copyA.primaryText : copyB.primaryText} headline={activeCopyTab === 'A' ? copyA.headline : copyB.headline} description={activeCopyTab === 'A' ? copyA.description : copyB.description} cta={cta} creativeUrl={creatives.find(c => c.copyIndex === (activeCopyTab === 'A' ? 0 : 1))?.url || null} websiteUrl={url} />
                {isBulk && <div className="mt-3 space-y-1">{creatives.map((c) => <div key={c.id} className="flex items-center gap-2 text-xs text-gray-500"><span className={clsx('px-1.5 py-0.5 rounded font-medium', c.copyIndex === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700')}>Copy {c.copyIndex === 0 ? 'A' : 'B'}</span><span className="truncate">{c.name}</span></div>)}</div>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Campaign settings</h3>
              <div><label className="label">Campaign objective</label><select {...register('objective')} className="input">{Object.values(CampaignObjective).map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Budget type</label><div className="flex gap-2">{([BudgetType.DAILY, BudgetType.LIFETIME] as const).map((bt) => <button key={bt} type="button" onClick={() => setValue('budgetType', bt)} className={clsx('btn btn-sm flex-1 justify-center', watch('budgetType') === bt && 'btn-primary')}>{bt}</button>)}</div></div>
              <div><label className="label">{watch('budgetType') === BudgetType.DAILY ? 'Daily' : 'Lifetime'} budget (USD)</label><input {...register('budgetAmount')} type="number" min="1" className="input" /></div>
              <hr className="border-gray-100" />
              <h4 className="text-sm font-semibold text-gray-800">Audience</h4>
              <div><label className="label">Locations</label><MapLocationPicker value={pinnedLocations} onChange={setPinnedLocations} /></div>
              <div><label className="label">Age range</label><div className="flex items-center gap-3"><input {...register('ageMin')} type="number" min="13" max="65" className="input w-20" /><span className="text-gray-400 text-sm">to</span><input {...register('ageMax')} type="number" min="13" max="65" className="input w-20" /></div></div>
              <div><label className="label">Interests</label><TagInput value={interests} onChange={setInterests} placeholder="Add interest…" /></div>
              <div><label className="label">Placements</label><select {...register('placements')} className="input">{Object.values(Placement).map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}</select></div>
              <div className="flex justify-between pt-2">
                <button className="btn btn-sm" onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-primary" onClick={handleSaveDraft} disabled={createAd.isPending}>
                  {createAd.isPending ? <><Spinner className="w-4 h-4" /> Saving {creatives.length} ads…</> : `Review & submit ${creatives.length > 1 ? `(${creatives.length} ads)` : ''} →`}
                </button>
              </div>
            </div>
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Creatives</h3>
              {creatives.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">{c.type === 'IMAGE' ? <img src={c.url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film className="w-5 h-5 text-gray-400" /></div>}</div>
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{c.name}</p><p className="text-xs text-gray-400">Ad {i + 1} · Copy {c.copyIndex === 0 ? 'A' : 'B'}</p></div>
                </div>
              ))}
              {isBulk && <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg p-3">All {creatives.length} ads will publish under the <strong>same campaign and ad set</strong>.</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Summary — {adIds.length} ad{adIds.length > 1 ? 's' : ''}</h3>
                <dl className="space-y-2 text-sm">
                  {[['Ad Type', selectedAdType.replace(/_/g, ' ')], ['URL', vals.url], ['Creatives', `${creatives.length} (${creatives.filter(c => c.copyIndex === 0).length}× Copy A, ${creatives.filter(c => c.copyIndex === 1).length}× Copy B)`], ['CTA', vals.cta?.replace(/_/g, ' ')], ['Budget', `$${vals.budgetAmount} ${vals.budgetType?.toLowerCase()}`], ['Audience', `${vals.ageMin}–${vals.ageMax} yrs`]].map(([k, v]) => (
                    <div key={k} className="flex gap-4"><dt className="w-24 text-gray-400 flex-shrink-0">{k}</dt><dd className="text-gray-900 break-all">{v}</dd></div>
                  ))}
                </dl>
              </div>
              <div className="card p-5 bg-amber-50 border-amber-100">
                <p className="text-sm text-amber-800 leading-relaxed"><strong>What happens next:</strong> All {adIds.length} ad{adIds.length > 1 ? 's' : ''} will be sent for admin review. Once approved, they publish under the same Meta campaign and ad set.</p>
              </div>
              <div className="flex justify-between">
                <button className="btn" onClick={() => setStep(3)}>← Back</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitAd.isPending || !adIds.length}>
                  {submitAd.isPending ? <><Spinner className="w-4 h-4" /> Submitting…</> : `Submit ${adIds.length} ad${adIds.length > 1 ? 's' : ''} for approval →`}
                </button>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Copy A preview</h3>
              <AdPreview primaryText={copyA.primaryText} headline={copyA.headline} description={copyA.description} cta={cta} creativeUrl={creatives.find(c => c.copyIndex === 0)?.url || null} websiteUrl={url} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
