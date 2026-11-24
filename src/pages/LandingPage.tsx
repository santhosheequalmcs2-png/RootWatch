import { ArrowRight, Box, CheckCircle2, Globe, LayoutDashboard, Moon, Sun } from 'lucide-react';
import React, { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { RootGrowthScene } from '../components/three/RootGrowthScene';
import { FARM_HERO_IMAGE } from '../data/samples';
import { useApp } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import type { PageId } from '../types/rootwatch';

interface LandingPageProps {
  onNavigate: (page: PageId) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { language, toggleLanguage, theme, toggleTheme, t } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contactState, setContactState] = useState<'idle' | 'success' | 'error'>('idle');
  const [contactErrorText, setContactErrorText] = useState('');
  const [farmImgFailed, setFarmImgFailed] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || message.trim().length < 6) {
      setContactState('error');
      setContactErrorText(t('contact_error'));
      return;
    }

    setSubmitting(true);
    setContactState('idle');
    try {
      await api.submitContact({
        name: name.trim(),
        email: email.trim(),
        farmLocation: farmLocation.trim(),
        message: message.trim(),
      });
      setContactState('success');
      setName('');
      setEmail('');
      setFarmLocation('');
      setMessage('');
    } catch (err) {
      setContactState('error');
      setContactErrorText(err instanceof Error ? err.message : t('contact_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#14231B] dark:bg-[#0C1410] dark:text-[#ECF3EE]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-[#DCE3DD] bg-[#F8F7F3]/95 dark:border-[#1E3126] dark:bg-[#0C1410]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            className="whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E7D4F]"
          >
            <BrandLogo />
          </a>

          {/* Zone 2: 4 concise single-line nav links */}
          <nav
            aria-label="Landing Navigation"
            className="hidden items-center gap-7 text-sm font-medium text-[#3C5447] md:flex dark:text-[#ADC4B7]"
          >
            <a
              href="#problem"
              className="transition-colors hover:text-[#122B1E] dark:hover:text-white whitespace-nowrap shrink-0"
            >
              {t('landing_nav_overview')}
            </a>
            <a
              href="#technology"
              className="transition-colors hover:text-[#122B1E] dark:hover:text-white whitespace-nowrap shrink-0"
            >
              {t('landing_nav_technology')}
            </a>
            <button
              type="button"
              onClick={() => onNavigate('device-3d')}
              className="transition-colors hover:text-[#122B1E] dark:hover:text-white whitespace-nowrap shrink-0"
            >
              {t('landing_nav_device')}
            </button>
            <a
              href="#benefits"
              className="transition-colors hover:text-[#122B1E] dark:hover:text-white whitespace-nowrap shrink-0"
            >
              {t('landing_nav_benefits')}
            </a>
          </nav>

          {/* Zone 3: Language Switch + Theme + Primary CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={language === 'en' ? 'Switch language to Tamil' : 'Switch language to English'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9D1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#153625] transition-colors hover:bg-[#ECF2ED] dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3] dark:hover:bg-[#1B2F24] whitespace-nowrap shrink-0"
            >
              <Globe className="h-3.5 w-3.5 text-[#2E7D4F] dark:text-[#6CD695]" />
              <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="hidden h-8 w-8 items-center justify-center rounded-lg border border-[#CFD9D1] bg-white text-[#2A4034] transition-colors hover:bg-[#ECF2ED] sm:inline-flex dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E4C34] dark:bg-[#2E7D4F] dark:hover:bg-[#256640] whitespace-nowrap shrink-0"
            >
              <span>{t('landing_hero_cta_dashboard')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Real Interactive Three.js Root Growth Visualization */}
      <section
        id="top"
        className="border-b border-[#DCE3DD] bg-gradient-to-b from-[#F3F5EE] to-[#F8F7F3] dark:border-[#1E3126] dark:from-[#0F1B14] dark:to-[#0C1410]"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-16 lg:px-8">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-medium text-[#2E7D4F] dark:text-[#7CE0A3]">
              {t('landing_hero_kicker')}
            </p>
            <h1 className="mt-4 max-w-2xl text-balance font-display text-4xl font-bold tracking-tight text-[#11261B] sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08] dark:text-[#F2F7F4]">
              {t('landing_hero_title')}
            </h1>
            <p className="mt-4 text-base font-medium text-[#5C4033] dark:text-[#D9B896]">
              {t('tagline')}
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#3E5548] dark:text-[#ACC2B5]">
              {t('landing_hero_subtitle')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#153625] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1E4B33] dark:bg-[#2E7D4F] dark:hover:bg-[#256640] whitespace-nowrap shrink-0"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{t('landing_hero_cta_dashboard')}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('device-3d')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#B9C8BD] bg-white px-5 py-3 text-sm font-semibold text-[#153625] transition-colors hover:bg-[#EDF2EE] dark:border-[#2C4738] dark:bg-[#132119] dark:text-[#E5F2EA] dark:hover:bg-[#1A2E23] whitespace-nowrap shrink-0"
              >
                <Box className="h-4 w-4 text-[#2E7D4F] dark:text-[#7BE0A2]" />
                <span>{t('landing_hero_cta_3d')}</span>
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#DCE3DD] pt-5 text-xs text-[#556B5F] dark:border-[#1E3126] dark:text-[#8CA697]">
              <span>6 Root-Zone Channels</span>
              <span aria-hidden="true">·</span>
              <span>Optical Rhizotron Imaging</span>
              <span aria-hidden="true">·</span>
              <span>English &amp; தமிழ்</span>
              <span aria-hidden="true">·</span>
              <span>SQLite Prototype Demo</span>
            </div>
          </div>

          <div className="flex flex-col justify-center lg:col-span-6">
            <RootGrowthScene compact />
            <p className="mt-2.5 text-xs text-[#5A7064] dark:text-[#8CA697]">
              {t('landing_3d_caption')}
            </p>
          </div>
        </div>
      </section>

      {/* Problem & Solution Overview */}
      <section id="problem" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold text-[#7A4F2E] dark:text-[#DDA97C]">
              {t('landing_problem_eyebrow')}
            </p>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-[#122B1E] dark:text-[#F0F6F2]">
              {t('landing_problem_title')}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#43594D] dark:text-[#A9BFB2]">
              {t('landing_problem_body')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 lg:col-span-7">
            {[
              { title: 'landing_problem_point_1_title', desc: 'landing_problem_point_1_desc', idx: '01' },
              { title: 'landing_problem_point_2_title', desc: 'landing_problem_point_2_desc', idx: '02' },
              { title: 'landing_problem_point_3_title', desc: 'landing_problem_point_3_desc', idx: '03' },
            ].map((item) => (
              <div
                key={item.idx}
                className="flex flex-col justify-between rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]"
              >
                <div>
                  <div className="font-mono text-xs font-semibold text-[#2E7D4F] dark:text-[#7BE0A2]">
                    {item.idx}
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                    {t(item.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
                    {t(item.desc)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How RootWatch Works (4-Step Editorial Strip) */}
      <section className="border-y border-[#DCE3DD] bg-[#F1F3EC] py-16 dark:border-[#1E3126] dark:bg-[#101B15]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#2E7D4F] dark:text-[#7BE0A2]">
              {t('landing_solution_eyebrow')}
            </p>
            <h2 className="mt-2 text-balance font-display text-3xl font-bold tracking-tight text-[#122B1E] dark:text-[#F0F6F2]">
              {t('landing_how_title')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#455B4F] dark:text-[#A8BEB1]">
              {t('landing_solution_body')}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'landing_how_step_1_title', desc: 'landing_how_step_1_desc', action: 'sensors' as PageId },
              { title: 'landing_how_step_2_title', desc: 'landing_how_step_2_desc', action: 'vision' as PageId },
              { title: 'landing_how_step_3_title', desc: 'landing_how_step_3_desc', action: 'ai' as PageId },
              { title: 'landing_how_step_4_title', desc: 'landing_how_step_4_desc', action: 'advisory' as PageId },
            ].map((step) => (
              <div
                key={step.title}
                className="flex flex-col justify-between rounded-xl border border-[#D8E0D9] bg-white p-6 dark:border-[#1E3126] dark:bg-[#13221A]"
              >
                <div>
                  <h3 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                    {t(step.title)}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
                    {t(step.desc)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(step.action)}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2E7D4F] hover:text-[#153625] dark:text-[#7BE0A2] dark:hover:text-white whitespace-nowrap"
                >
                  <span>{t(`nav_${step.action}`)}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sensor Technology & AI Capabilities */}
      <section id="technology" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-[#122B1E] dark:text-[#F0F6F2]">
              {t('landing_tech_title')}
            </h2>
            <p className="mt-2.5 text-sm text-[#4B6155] dark:text-[#9DB4A7]">
              {t('landing_solution_title')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('device-3d')}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-[#C6D2C8] bg-white px-4 py-2 text-xs font-semibold text-[#153625] transition-colors hover:bg-[#EDF2EE] sm:self-auto dark:border-[#273E31] dark:bg-[#13221A] dark:text-[#DCEEE3] whitespace-nowrap shrink-0"
          >
            <Box className="h-3.5 w-3.5 text-[#2E7D4F] dark:text-[#7BE0A2]" />
            <span>{t('landing_hero_cta_3d')}</span>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {[
            { title: 'landing_tech_sensor_1', desc: 'landing_tech_sensor_1_desc', meta: '10 cm / 25 cm · Capacitive' },
            { title: 'landing_tech_sensor_2', desc: 'landing_tech_sensor_2_desc', meta: '°C · pH · mS/cm' },
            { title: 'landing_tech_sensor_3', desc: 'landing_tech_sensor_3_desc', meta: '5MP Macro · 5500K LED' },
            { title: 'landing_tech_sensor_4', desc: 'landing_tech_sensor_4_desc', meta: 'kΩ · Experimental R&D' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]"
            >
              <div className="font-mono text-xs text-[#6B5440] dark:text-[#D5B08B]">{item.meta}</div>
              <h3 className="mt-2 font-display text-lg font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                {t(item.title)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
                {t(item.desc)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Farmer Benefits & Sustainable Agriculture with Real Field Photography */}
      <section
        id="benefits"
        className="border-y border-[#DCE3DD] bg-[#12261C] py-16 text-[#EDF4EF] dark:border-[#1E3126]"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-white/10 bg-[#1A3527]">
              {!farmImgFailed ? (
                <img
                  src={FARM_HERO_IMAGE}
                  alt="RootWatch field monitoring node placed in a raised-bed agricultural farm in Tamil Nadu"
                  referrerPolicy="no-referrer"
                  onError={() => setFarmImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-sm text-[#A9C7B7]">
                  RootWatch Tamil Nadu Demonstration Field
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-semibold text-[#7BE0A2]">{t('landing_benefits_eyebrow')}</p>
            <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-white">
              {t('landing_benefits_title')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#B9D0C3]">
              {t('landing_benefits_body')}
            </p>

            <div className="mt-7 space-y-5">
              {[
                { title: 'landing_benefit_1', desc: 'landing_benefit_1_desc' },
                { title: 'landing_benefit_2', desc: 'landing_benefit_2_desc' },
                { title: 'landing_benefit_3', desc: 'landing_benefit_3_desc' },
              ].map((b) => (
                <div key={b.title} className="border-t border-white/10 pt-4">
                  <h3 className="font-display text-base font-semibold text-white">{t(b.title)}</h3>
                  <p className="mt-1 text-sm text-[#B1C9BC]">{t(b.desc)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact / Pilot Inquiry + Footer */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] dark:text-[#F0F6F2]">
              {t('landing_contact_title')}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
              {t('landing_contact_subtitle')}
            </p>
            <div className="mt-6 space-y-2 text-xs text-[#5A7064] dark:text-[#8CA697]">
              <div>{t('demo_mode_label')}</div>
              <div>{t('live_hardware_note')}</div>
            </div>
          </div>

          <form
            onSubmit={handleContactSubmit}
            noValidate
            className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-7 dark:border-[#1E3126] dark:bg-[#121F18]"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-medium text-[#2E4639] dark:text-[#BDD2C6]"
                >
                  {t('contact_name')}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-xs font-medium text-[#2E4639] dark:text-[#BDD2C6]"
                >
                  {t('contact_email')}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
                />
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="contact-location"
                className="block text-xs font-medium text-[#2E4639] dark:text-[#BDD2C6]"
              >
                {t('contact_location')}
              </label>
              <input
                id="contact-location"
                type="text"
                value={farmLocation}
                onChange={(e) => setFarmLocation(e.target.value)}
                placeholder="e.g. Erode / Coimbatore, Tamil Nadu"
                className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
              />
            </div>

            <div className="mt-4">
              <label
                htmlFor="contact-message"
                className="block text-xs font-medium text-[#2E4639] dark:text-[#BDD2C6]"
              >
                {t('contact_message')}
              </label>
              <textarea
                id="contact-message"
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
              />
            </div>

            {contactState === 'error' && (
              <p className="mt-3 text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5]">
                {contactErrorText}
              </p>
            )}
            {contactState === 'success' && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#1E6B40] dark:text-[#7BE0A2]">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('contact_success')}</span>
              </p>
            )}

            <div className="mt-5">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#153625] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F] dark:hover:bg-[#256640]"
              >
                <span>{t('contact_submit')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </section>

      <footer className="border-t border-[#DCE3DD] bg-[#F1F3EC] py-8 dark:border-[#1E3126] dark:bg-[#0E1813]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <BrandLogo />
          <p className="text-xs text-[#5A7064] dark:text-[#8BA396]">{t('footer_note')}</p>
        </div>
      </footer>
    </div>
  );
}
