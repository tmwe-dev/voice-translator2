// b.605 — IL REGISTRO DELLE SCHERMATE.
//
// Modulo F1 dell'audit di architettura (b.598): page.js dichiarava 26
// `lazy(() => import(...))` sparsi in due blocchi, piu' il segnaposto di
// caricamento, in mezzo a 1.900 righe di stato e orchestrazione. Qui
// stanno tutte, in un file che fa UNA cosa: dire quali schermate
// esistono e come si caricano. page.js le importa.
//
// (b.595: e' anche il file che knip riesce a leggere senza inciampare
// nelle graffe dei template literal di page.js.)
'use client';
import { lazy } from 'react';

export const AccountView = lazy(() => import('../components/AccountView.js'));
export const CreditsView = lazy(() => import('../components/CreditsView.js'));
export const ApiKeysView = lazy(() => import('../components/ApiKeysView.js'));
export const SettingsView = lazy(() => import('../components/SettingsView.js'));
export const LobbyView = lazy(() => import('../components/LobbyView.js'));
export const PannelloModerazione = lazy(() => import('../components/PannelloModerazione.js'));
export const StanzaVideoGruppo = lazy(() => import('../components/StanzaVideoGruppo.js'));
export const RoomView = lazy(() => import('../components/RoomView.js'));
export const StanzeView = lazy(() => import('../components/StanzeView.js'));
export const HistoryView = lazy(() => import('../components/HistoryView.js'));
export const SummaryView = lazy(() => import('../components/SummaryView.js'));
export const VoiceTestView = lazy(() => import('../components/VoiceTestView.js'));
export const ContactsView = lazy(() => import('../components/ContactsView.js'));
export const VoiceCloneView = lazy(() => import('../components/VoiceCloneView.js'));
export const MondoView = lazy(() => import('../components/MondoView.js'));
export const LifeView = lazy(() => import('../components/Life/LifeView.js'));
export const BusinessView = lazy(() => import('../components/BusinessView.js'));
export const SpeakerView = lazy(() => import('../components/SpeakerView.js'));
export const TaxiTalk = lazy(() => import('../components/TaxiTalk.js'));
export const QuickInvite = lazy(() => import('../components/QuickInvite.js'));
export const HelpView = lazy(() => import('../components/HelpView.js'));
export const TaxiDriverView = lazy(() => import('../components/TaxiDriverView.js'));
export const CreateRoomSheet = lazy(() => import('../components/CreateRoomSheet.js'));
export const AIView = lazy(() => import('../components/AIView.js'));
export const DetailView = lazy(() => import('../components/DetailView.js'));

// ═══ Lazy loading fallback ═══
export const LazyFallback = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',background:'#060810'}}>
    <div style={{width:32,height:32,borderRadius:'50%',border:'3px solid rgba(38,217,176,0.2)',borderTopColor:'#26D9B0',animation:'vtSpin 0.8s linear infinite'}} />
    <style>{`@keyframes vtSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
