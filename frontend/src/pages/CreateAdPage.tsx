import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useGenerateCopy, useRegenerateCopy, useUploadCreative, useCreateAd, useUpdateAd, useSubmitAd } from '../hooks';
import { AdPreview, Spinner } from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { CampaignObjective, BudgetType, CtaType, Placement } from '@shared/types';
import { getErrorMessage } from '../lib/api';
import clsx from 'clsx';
import { UploadCloud, RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';

// ─── Ad type config ───────────────────────────────────────────────────────────
const AD_TYPES = [
  {
    id: CampaignObjective.TRAFFIC,
    label: 'Traffic',
    icon: Zap,
    color: 'indigo',
    description: 'Drive visitors to your website or landing page',
    badge: 'Most Popular',
  },
  {
    id: CampaignObjective.SALES,
    label: 'Sales',
    icon: ShoppingBag,
    color: 'emerald',
    description: 'Increase conversions and purchases',
    badge: null,
  },
  {
    id: CampaignObjective.AWARENESS,
    label: 'Awareness',
    icon: Eye,
    color: 'violet',
    description: 'Reach more people and grow brand recognition',
    badge: null,
  },
];


// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ['Ad details', 'AI copy', 'Campaign setup', 'Review & submit'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className={clsx('flex items-center gap-2', active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-gray-400')}>
              <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border-2', {
                'border-indigo-600 bg-indigo-600 text-white': active,
                'border-emerald-500 bg-emerald-500 text-white': done,
                'border-gray-300 bg-white text-gray-400': !active && !done,
              })}>
                {done ? '✓' : n}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={clsx('flex-1 h-px mx-3 min-w-8', done ? 'bg-emerald-300' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ value, onChange, placeholder }: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
            {tag}
            <button onClick={() => onChange(value.filter((t) => t !== tag))}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Type and press Enter'}
        />
        <button type="button" onClick={add} className="btn btn-sm">Add</button>
      </div>
    </div>
  );
}

// ─── Location picker ─────────────────────────────────────────────────────────
const POPULAR_LOCATIONS = [
  { key: 'US', name: 'United States', type: 'country', flag: '🇺🇸' },
  { key: 'GB', name: 'United Kingdom', type: 'country', flag: '🇬🇧' },
  { key: 'CA', name: 'Canada', type: 'country', flag: '🇨🇦' },
  { key: 'AU', name: 'Australia', type: 'country', flag: '🇦🇺' },
  { key: 'DE', name: 'Germany', type: 'country', flag: '🇩🇪' },
  { key: 'FR', name: 'France', type: 'country', flag: '🇫🇷' },
  { key: 'IN', name: 'India', type: 'country', flag: '🇮🇳' },
  { key: 'BR', name: 'Brazil', type: 'country', flag: '🇧🇷' },
  { key: 'JP', name: 'Japan', type: 'country', flag: '🇯🇵' },
  { key: 'MX', name: 'Mexico', type: 'country', flag: '🇲🇽' },
  { key: 'NG', name: 'Nigeria', type: 'country', flag: '🇳🇬' },
  { key: 'ZA', name: 'South Africa', type: 'country', flag: '🇿🇦' },
  { key: 'AE', name: 'United Arab Emirates', type: 'country', flag: '🇦🇪' },
  { key: 'SG', name: 'Singapore', type: 'country', flag: '🇸🇬' },
  { key: 'NL', name: 'Netherlands', type: 'country', flag: '🇳🇱' },
  { key: 'ES', name: 'Spain', type: 'country', flag: '🇪🇸' },
  { key: 'IT', name: 'Italy', type: 'country', flag: '🇮🇹' },
  { key: 'PK', name: 'Pakistan', type: 'country', flag: '🇵🇰' },
  { key: 'BD', name: 'Bangladesh', type: 'country', flag: '🇧🇩' },
  { key: 'PH', name: 'Philippines', type: 'country', flag: '🇵🇭' },
  { key: 'ID', name: 'Indonesia', type: 'country', flag: '🇮🇩' },
  { key: 'TR', name: 'Turkey', type: 'country', flag: '🇹🇷' },
  { key: 'SA', name: 'Saudi Arabia', type: 'country', flag: '🇸🇦' },
  { key: 'EG', name: 'Egypt', type: 'country', flag: '🇪🇬' },
  { key: 'KE', name: 'Kenya', type: 'country', flag: '🇰🇪' },
  { key: 'GH', name: 'Ghana', type: 'country', flag: '🇬🇭' },
  { key: 'AR', name: 'Argentina', type: 'country', flag: '🇦🇷' },
  { key: 'CO', name: 'Colombia', type: 'country', flag: '🇨🇴' },
  { key: 'MY', name: 'Malaysia', type: 'country', flag: '🇲🇾' },
  { key: 'TH', name: 'Thailand', type: 'country', flag: '🇹🇭' },
];

interface Location { key: string; name: string; type: string; flag?: string; }

function LocationPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = search.trim().length > 0
    ? POPULAR_LOCATIONS.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.key.toLowerCase().includes(search.toLowerCase())
      )
    : POPULAR_LOCATIONS;

  const addLocation = (loc: Location) => {
    if (!value.includes(loc.name)) {
      onChange([...value, loc.name]);
    }
    setSearch('');
    setShowDropdown(false);
  };

  const removeLocation = (name: string) => {
    onChange(value.filter(v => v !== name));
  };

  return (
    <div className="space-y-2">
      {/* Selected locations */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((loc) => {
            const found = POPULAR_LOCATIONS.find(l => l.name === loc);
            return (
              <span key={loc} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                {found?.flag && <span>{found.flag}</span>}
                {loc}
                <button
                  type="button"
                  onClick={() => removeLocation(loc)}
                  className="hover:text-indigo-900 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          className="input pr-8"
          placeholder="Search country or region…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 p-3 text-center">No results found</p>
            ) : (
              filtered.map((loc) => {
                const isSelected = value.includes(loc.name);
                return (
                  <button
                    key={loc.key}
                    type="button"
                    onMouseDown={() => addLocation(loc)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors',
                      isSelected && 'opacity-40 cursor-not-allowed'
                    )}
                    disabled={isSelected}
                  >
                    <span className="text-base">{loc.flag}</span>
                    <span className="flex-1 text-gray-800">{loc.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{loc.key}</span>
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {!value.length && (
        <p className="text-xs text-gray-400">Search and select one or more countries or regions</p>
      )}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export function CreateAdPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [adId, setAdId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedType, setUploadedType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [interests, setInterests] = useState(['Technology', 'Business']);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedAdType, setSelectedAdType] = useState<CampaignObjective>(CampaignObjective.TRAFFIC);

  const { register, watch, setValue, getValues } = useForm({
    defaultValues: {
      url: '',
      primaryText: '',
      headline: '',
      description: '',
      cta: CtaType.LEARN_MORE,
      objective: CampaignObjective.TRAFFIC,
      budgetType: BudgetType.DAILY,
      budgetAmount: 25,
      ageMin: 18,
      ageMax: 65,
      placements: [Placement.AUTOMATIC],
    },
  });

  const generateCopy = useGenerateCopy();
  const regenerateCopy = useRegenerateCopy();
  const uploadCreative = useUploadCreative();
  const createAd = useCreateAd();
  const updateAd = useUpdateAd(adId ?? '');
  const submitAd = useSubmitAd();

  const primaryText = watch('primaryText');
  const headline = watch('headline');
  const description = watch('description');
  const cta = watch('cta');
  const url = watch('url');

  // ── Step 1 → Step 2: extract + generate ──────────────────────────────────
  const handleGenerate = async () => {
    setError('');
    if (!url) { setError('Please enter a URL'); return; }
    // Set objective from selected ad type
    setValue('objective', selectedAdType);
    try {
      const result = await generateCopy.mutateAsync({ url });
      setValue('primaryText', result.copy.primaryText);
      setValue('headline', result.copy.headline);
      setValue('description', result.copy.description);
      setStep(2);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const handleRegenerate = async () => {
    try {
      const copy = await regenerateCopy.mutateAsync({
        url,
        existingCopy: { primaryText, headline, description },
      });
      setValue('primaryText', copy.primaryText);
      setValue('headline', copy.headline);
      setValue('description', copy.description);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const result = await uploadCreative.mutateAsync(file);
      setUploadedUrl(result.url);
      setUploadedType(result.type);
    } catch (e) { setError(getErrorMessage(e)); }
  }, [uploadCreative]);

  // ── Step 3 → Step 4: save draft ────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setError('');
    const vals = getValues();
    const payload = {
      websiteUrl: vals.url,
      primaryText: vals.primaryText,
      headline: vals.headline,
      description: vals.description,
      cta: vals.cta,
      creativeUrl: uploadedUrl ?? undefined,
      creativeType: uploadedUrl ? uploadedType : undefined,
      objective: vals.objective,
      budgetType: vals.budgetType,
      budgetAmount: Number(vals.budgetAmount),
      ageMin: Number(vals.ageMin),
      ageMax: Number(vals.ageMax),
      locations,
      interests,
      placements: [vals.placements].flat(),
    };

    try {
      if (adId) {
        await updateAd.mutateAsync(payload);
      } else {
        const ad = await createAd.mutateAsync(payload);
        setAdId(ad.id);
      }
      setStep(4);
    } catch (e) { setError(getErrorMessage(e)); }
  };

  // ── Step 4: submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!adId) return;
    setError('');
    try {
      await submitAd.mutateAsync(adId);
      navigate('/ads');
    } catch (e) { setError(getErrorMessage(e)); }
  };

  const vals = getValues();

  return (
    <div>
      <PageHeader title="Create new ad" description="AI-powered ad creation in 4 steps" />
      <div className="p-6 max-w-5xl">
        <Steps current={step} />

        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── STEP 1 ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">



            {/* ── URL + Upload ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-5 space-y-4">
                <h3 className="font-semibold text-gray-900">Ad details</h3>
                <div>
                  <label className="label">Website / event URL *</label>
                  <input
                    {...register('url')}
                    type="url"
                    className="input"
                    placeholder="https://yourbusiness.com/product"
                  />
                </div>
                <div>
                  <label className="label">Upload creative (image or video)</label>
                  <label
                    className={clsx(
                      'flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                      uploadedUrl
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    )}
                  >
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    {uploadCreative.isPending ? (
                      <Spinner />
                    ) : uploadedUrl ? (
                      <>
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                        <span className="text-sm text-emerald-700 font-medium">Creative uploaded</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-gray-300" />
                        <span className="text-sm text-gray-500">Click to upload image or video</span>
                        <span className="text-xs text-gray-400">JPG, PNG, MP4 — max 30 MB</span>
                      </>
                    )}
                  </label>
                  {uploadedUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 h-28">
                      {uploadedType === 'IMAGE' ? (
                        <img src={uploadedUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={uploadedUrl} className="w-full h-full object-cover" />
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary w-full justify-center"
                  onClick={handleGenerate}
                  disabled={generateCopy.isPending}
                >
                  {generateCopy.isPending ? (
                    <><Spinner className="w-4 h-4" /> Extracting & generating copy…</>
                  ) : (
                    'Generate AI copy →'
                  )}
                </button>
              </div>

              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">How it works</h3>
                {[
                  ['Choose ad type', 'Select your campaign goal — traffic, sales, or awareness'],
                  ['Paste your URL', 'We extract the page title, description, and metadata'],
                  ['AI generates copy', 'Claude writes primary text, headline, and description'],
                  ['Submit for review', 'Admin approves and it automatically publishes to Meta'],
                ].map(([title, desc], i) => (
                  <div key={i} className="flex gap-3 mb-4">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-6">
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">AI-generated copy</h3>
                <button
                  className="btn btn-sm gap-1"
                  onClick={handleRegenerate}
                  disabled={regenerateCopy.isPending}
                >
                  <RefreshCw className={clsx('w-3 h-3', regenerateCopy.isPending && 'animate-spin')} />
                  Regenerate
                </button>
              </div>

              {regenerateCopy.isPending && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm">
                  <Spinner className="w-4 h-4" /> Generating new copy…
                </div>
              )}

              <div>
                <label className="label">Primary text</label>
                <textarea {...register('primaryText')} className="input min-h-[100px]" rows={4} />
              </div>
              <div>
                <label className="label">Headline</label>
                <input {...register('headline')} className="input" />
              </div>
              <div>
                <label className="label">Description</label>
                <input {...register('description')} className="input" />
              </div>
              <div>
                <label className="label">Call to action</label>
                <select {...register('cta')} className="input">
                  {Object.values(CtaType).map((v) => (
                    <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between pt-2">
                <button className="btn btn-sm" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>Set up campaign →</button>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Ad preview</h3>
              <AdPreview
                primaryText={primaryText}
                headline={headline}
                description={description}
                cta={cta}
                creativeUrl={uploadedUrl}
                websiteUrl={url}
              />
              <p className="text-xs text-gray-400 mt-3">Preview updates as you edit</p>
            </div>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="grid grid-cols-2 gap-6">
            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Campaign settings</h3>

              <div>
                <label className="label">Campaign objective</label>
                <select {...register('objective')} className="input">
                  {Object.values(CampaignObjective).map((v) => (
                    <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Budget type</label>
                <div className="flex gap-2">
                  {([BudgetType.DAILY, BudgetType.LIFETIME] as const).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setValue('budgetType', bt)}
                      className={clsx('btn btn-sm flex-1 justify-center', watch('budgetType') === bt && 'btn-primary')}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">
                  {watch('budgetType') === BudgetType.DAILY ? 'Daily' : 'Lifetime'} budget (USD)
                </label>
                <input {...register('budgetAmount')} type="number" min="1" className="input" />
              </div>

              <hr className="border-gray-100" />
              <h4 className="text-sm font-semibold text-gray-800">Audience</h4>

              <div>
                <label className="label">Locations</label>
                <LocationPicker value={locations} onChange={setLocations} />
              </div>

              <div>
                <label className="label">Age range</label>
                <div className="flex items-center gap-3">
                  <input {...register('ageMin')} type="number" min="13" max="65" className="input w-20" />
                  <span className="text-gray-400 text-sm">to</span>
                  <input {...register('ageMax')} type="number" min="13" max="65" className="input w-20" />
                </div>
              </div>

              <div>
                <label className="label">Interests</label>
                <TagInput value={interests} onChange={setInterests} placeholder="Add interest…" />
              </div>

              <div>
                <label className="label">Placements</label>
                <select {...register('placements')} className="input">
                  {Object.values(Placement).map((v) => (
                    <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between pt-2">
                <button className="btn btn-sm" onClick={() => setStep(2)}>← Back</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveDraft}
                  disabled={createAd.isPending || updateAd.isPending}
                >
                  {createAd.isPending || updateAd.isPending
                    ? <><Spinner className="w-4 h-4" /> Saving…</>
                    : 'Review & submit →'
                  }
                </button>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">Audience estimate</h3>
              <div className="stat-card">
                <p className="text-xs text-gray-500 mb-1">Estimated daily reach</p>
                <p className="text-2xl font-semibold">1.2M – 3.5M</p>
                <p className="text-xs text-gray-400 mt-1">people per day</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Est. clicks/day</p>
                  <p className="text-xl font-semibold">120–380</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Est. CPC</p>
                  <p className="text-xl font-semibold">$0.65</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Audience definition</p>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-2/5 bg-indigo-500 rounded-full" />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Narrow</span><span>Balanced</span><span>Broad</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4 ─────────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Ad Type', AD_TYPES.find(t => t.id === selectedAdType)?.label ?? selectedAdType],
                    ['URL', vals.url],
                    ['Headline', vals.headline],
                    ['CTA', vals.cta?.replace(/_/g, ' ')],
                    ['Objective', vals.objective?.replace(/_/g, ' ')],
                    ['Budget', `$${vals.budgetAmount} ${vals.budgetType?.toLowerCase()}`],
                    ['Audience', `${vals.ageMin}–${vals.ageMax} yrs · ${locations.join(', ')}`],
                    ['Creative', uploadedUrl ? `${uploadedType} uploaded` : 'None'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-4">
                      <dt className="w-24 text-gray-400 flex-shrink-0">{k}</dt>
                      <dd className="text-gray-900 break-all">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="card p-5 bg-amber-50 border-amber-100">
                <p className="text-sm text-amber-800 leading-relaxed">
                  <strong>What happens next:</strong> Your ad will be sent to an admin for review.
                  Once approved, it will automatically publish to Meta via the Marketing API.
                  You'll see status updates in My Ads.
                </p>
              </div>

              <div className="flex justify-between">
                <button className="btn" onClick={() => setStep(3)}>← Back</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={submitAd.isPending || !adId}
                >
                  {submitAd.isPending ? <><Spinner className="w-4 h-4" /> Submitting…</> : 'Submit for approval →'}
                </button>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Final preview</h3>
              <AdPreview
                primaryText={primaryText}
                headline={headline}
                description={description}
                cta={cta}
                creativeUrl={uploadedUrl}
                websiteUrl={url}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
