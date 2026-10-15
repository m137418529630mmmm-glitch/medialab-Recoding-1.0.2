/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CaptureModeSelector } from './components/CaptureModeSelector';
import { QualitySettings } from './components/QualitySettings';
import { StorageAndNaming } from './components/StorageAndNaming';
import { SettingsModal } from './components/SettingsModal';
import { InteractiveRegionSelector } from './components/InteractiveRegionSelector';
import { LiveRecordingOverlay } from './components/LiveRecordingOverlay';
import {
  CaptureMode,
  AspectRatioPreset,
  RegionCoordinates,
  ResolutionOption,
  FpsOption,
  SharpnessMode,
  VideoFormat,
  ToggleSettings,
  StorageSettings,
} from './types/recorder';
import { Language, translations } from './utils/translations';
import { localDateStamp } from './utils/format';
import { CircleDot, CheckCircle2 } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'medialab_recorder_settings_v2';

export default function App() {
  // Helper to load settings from localStorage on initial load
  const loadSavedSettings = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  };

  const initialConfig = loadSavedSettings();

  // Language state - English default
  const [lang, setLang] = useState<Language>(initialConfig?.lang || 'en');
  const t = translations[lang];
  // Latest strings/handlers for callbacks that are registered once (IPC listeners).
  const tRef = useRef(t);
  tRef.current = t;
  const handleStartRef = useRef<(skipCountdown?: boolean) => void>(() => {});
  const toastTimerRef = useRef<any>(null);

  // Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Capture Mode
  const [captureMode, setCaptureMode] = useState<CaptureMode>(
    initialConfig?.captureMode || 'region'
  );
  const [aspectPreset, setAspectPreset] = useState<AspectRatioPreset>(
    initialConfig?.aspectPreset || '16:9'
  );
  const [region, setRegion] = useState<RegionCoordinates>(
    initialConfig?.region || {
      x: 320,
      y: 180,
      width: 1920,
      height: 1080,
    }
  );
  const [selectedWindowId, setSelectedWindowId] = useState<string>(
    initialConfig?.selectedWindowId || ''
  );

  // Quality & FPS
  const [resolution, setResolution] = useState<ResolutionOption>(
    initialConfig?.resolution || 'native'
  );
  const [fps, setFps] = useState<FpsOption>(initialConfig?.fps || 30);
  const [sharpness, setSharpness] = useState<SharpnessMode>(
    initialConfig?.sharpness || 'balanced'
  );
  const [videoFormat, setVideoFormat] = useState<VideoFormat>(
    initialConfig?.videoFormat || 'mp4'
  );

  // Secondary Toggles
  const [toggles, setToggles] = useState<ToggleSettings>(() => {
    const defaults: ToggleSettings = {
      hideCursor: true,
      highlightClicks: false,
      systemAudio: false,
      micAudio: false,
      countdown3s: true,
      countdownDuration: 3,
      autoStopEnabled: false,
      autoStopHours: 0,
      autoStopMinutes: 5,
      autoStopSeconds: 0,
    };
    return {
      ...defaults,
      ...(initialConfig?.toggles || {}),
    };
  });

  // Storage
  const [storage, setStorage] = useState<StorageSettings>(
    initialConfig?.storage || {
      savePath: '',
      autoSequential: true,
      startIndex: 0,
      currentIndex: 0,
      prefix: '',
      format: 'mp4',
    }
  );
  const [nativePreferencesLoaded, setNativePreferencesLoaded] = useState(!window.electronAPI);

  // Synchronize format with storage
  useEffect(() => {
    setStorage((prev) => ({ ...prev, format: videoFormat }));
  }, [videoFormat]);

  useEffect(() => {
    // Do not overwrite the native saved folder with React's initial/default state.
    if (!nativePreferencesLoaded || !storage.savePath) return;
    window.electronAPI?.savePreferences?.({ savePath: storage.savePath });
  }, [storage.savePath, nativePreferencesLoaded]);

  // PERSIST ALL SETTINGS TO LOCALSTORAGE WHENEVER THEY CHANGE
  useEffect(() => {
    try {
      const configToSave = {
        lang,
        captureMode,
        aspectPreset,
        region,
        selectedWindowId,
        resolution,
        fps,
        sharpness,
        videoFormat,
        toggles,
        storage,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(configToSave));
    } catch {
      // ignore
    }
  }, [
    lang,
    captureMode,
    aspectPreset,
    region,
    selectedWindowId,
    resolution,
    fps,
    sharpness,
    videoFormat,
    toggles,
    storage,
  ]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getDefaultSaveInfo(initialConfig?.storage?.savePath).then((info: any) => {
      const savedPath = info?.savePath;
      if (savedPath) {
        setStorage((prev) => ({
          ...prev,
          // Native preferences are the source of truth for the folder across app restarts.
          savePath: savedPath,
          currentIndex: info.currentIndex ?? prev.currentIndex,
        }));
      }
    }).catch(() => {}).finally(() => setNativePreferencesLoaded(true));
    const offStatus = window.electronAPI.onRecordingStatusChange((event: any) => {
      if (event?.status) {
        if (event.status === 'idle') {
          setRecordingStatus('idle');
          setRecordingSeconds(0);
        } else if (event.status === 'recording' || event.status === 'paused') {
          setRecordingStatus(event.status);
        }
      }
    });
    const offSaved = window.electronAPI.onRecordingSaved((result: any) => {
      if (result?.currentIndex != null) setStorage(prev => ({ ...prev, currentIndex: result.currentIndex }));
      showToast(`${tRef.current.toastSaved}: ${result?.fileName || ''}`);
    });
    const offError = window.electronAPI.onRecordingError?.((message: string) => showToast(message));
    const offHotkey = window.electronAPI.onHotkeyStart?.(() => handleStartRef.current(true));
    return () => { if (typeof offHotkey === 'function') offHotkey(); if (typeof offStatus === 'function') offStatus(); if (typeof offSaved === 'function') offSaved(); if (typeof offError === 'function') offError(); };
  }, []);

  // Modals
  const [isRegionPickerOpen, setIsRegionPickerOpen] = useState(false);

  // Live Recording state
  const [recordingStatus, setRecordingStatus] = useState<
    'idle' | 'countdown' | 'recording' | 'paused'
  >('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [countdownValue, setCountdownValue] = useState(3);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const countdownTimerRef = useRef<any>(null);
  const recordIntervalRef = useRef<any>(null);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const isElectron = !!window.electronAPI;
  const startNativeRecording = async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.startRecord({
        mode: captureMode,
        region,
        windowTitle: selectedWindowId,
        resolution,
        fps,
        sharpness,
        hideCursor: toggles.hideCursor,
        systemAudio: toggles.systemAudio,
        micAudio: toggles.micAudio,
        format: storage.format,
        savePath: storage.savePath,
        currentIndex: storage.currentIndex,
        prefix: storage.prefix.trim(),
        autoSequential: storage.autoSequential,
      });
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : 'Could not start recording');
      setRecordingStatus('idle');
    }
  };

  const handleStartRecording = (skipCountdown = false) => {
    if (recordingStatus !== 'idle') return;

    if (toggles.countdown3s && !skipCountdown) {
      setRecordingStatus('countdown');
      setCountdownValue(toggles.countdownDuration);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      let currentCount = toggles.countdownDuration;
      countdownTimerRef.current = setInterval(() => {
        currentCount -= 1;
        if (currentCount <= 0) {
          clearInterval(countdownTimerRef.current);
          setRecordingStatus('recording');
          setRecordingSeconds(0);
          void startNativeRecording();
        } else {
          setCountdownValue(currentCount);
        }
      }, 1000);
    } else {
      setRecordingStatus('recording');
      setRecordingSeconds(0);
      void startNativeRecording();
    }
  };

  const handlePauseResume = () => {
    if (recordingStatus === 'recording') {
      setRecordingStatus('paused');
      void window.electronAPI?.pauseRecord();
    } else if (recordingStatus === 'paused') {
      setRecordingStatus('recording');
      void window.electronAPI?.resumeRecord();
    }
  };

  const stopInProgressRef = useRef<Promise<any> | null>(null);

  const handleStopAndSave = async () => {
    if (stopInProgressRef.current) return stopInProgressRef.current;
    const stopTask = (async () => {
      // Stop pressed during the countdown = cancel (nothing has been recorded yet).
      if (recordingStatus === 'countdown') {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        setRecordingStatus('idle');
        setRecordingSeconds(0);
        showToast(t.countdownCancelled);
        return;
      }

      let nativeResult: any = null;
      if (window.electronAPI) {
        try {
          nativeResult = await window.electronAPI.stopSave();
          if (!nativeResult?.path) {
            setRecordingStatus('idle');
            setRecordingSeconds(0);
            showToast(lang === 'en' ? 'Recording was not saved. Please try again.' : 'لم يتم حفظ التسجيل. حاول مرة أخرى.');
            return;
          }
        } catch (error) {
          // The main process resets itself and reports "idle" even when saving fails.
          showToast(error instanceof Error ? error.message : 'Could not save recording');
          return;
        }
      }

      setRecordingStatus('idle');
      setRecordingSeconds(0);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

      // In Electron the main process already returned the next free index and shows the
      // "saved" toast (via the recording-saved event). Only the browser preview needs this.
      if (!nativeResult) {
        if (storage.autoSequential) {
          setStorage((prev) => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
        }
        const previewName = storage.autoSequential
          ? `${storage.prefix.trim()}${storage.currentIndex}.${storage.format}`
          : `recording_${localDateStamp()}.${storage.format}`;
        showToast(`${t.toastSaved}: ${previewName}`);
      }
    })();
    stopInProgressRef.current = stopTask;
    try { await stopTask; }
    finally { stopInProgressRef.current = null; }
  };

  const handleStopAndSaveRef = useRef(handleStopAndSave);
  handleStopAndSaveRef.current = handleStopAndSave;
  handleStartRef.current = handleStartRecording;

  // Elapsed-seconds ticker (only while actively recording; paused/idle stop it).
  useEffect(() => {
    if (recordingStatus !== 'recording') return;
    recordIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, [recordingStatus]);

  // Auto-stop: kept out of the state updater so it has no side effects inside it.
  useEffect(() => {
    if (recordingStatus !== 'recording' || !toggles.autoStopEnabled) return;
    const targetSecs =
      (toggles.autoStopHours || 0) * 3600 +
      (toggles.autoStopMinutes || 0) * 60 +
      (toggles.autoStopSeconds || 0);
    if (targetSecs > 0 && recordingSeconds >= targetSecs && !stopInProgressRef.current) {
      showToast(`${t.autoStopToast} ${formatTimer(targetSecs)}`);
      void handleStopAndSaveRef.current();
    }
  }, [
    recordingSeconds,
    recordingStatus,
    toggles.autoStopEnabled,
    toggles.autoStopHours,
    toggles.autoStopMinutes,
    toggles.autoStopSeconds,
  ]);

  const handleTakeSnapshot = () => {
    showToast(t.snapshotUnavailable);
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F3F0] text-[#1E1D1B] flex flex-col font-sans selection:bg-[#D85631]/20 selection:text-[#D85631]">
      {/* Top Header with permanent logo & settings */}
      <Header
        lang={lang}
        setLang={setLang}
        onOpenSettings={() => setIsSettingsOpen(true)}
        recordingStatus={recordingStatus}
        recordingTimer={formatTimer(recordingSeconds)}
        onStopRecording={() => handleStopAndSave()}
        onPauseResumeRecording={handlePauseResume}
      />

      {/* Main Container - Centered, strictly bounded, NO overflow */}
      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-5 space-y-4 box-border overflow-x-hidden">
        {/* Section 1: Capture Mode */}
        <CaptureModeSelector
          lang={lang}
          captureMode={captureMode}
          setCaptureMode={setCaptureMode}
          aspectPreset={aspectPreset}
          setAspectPreset={setAspectPreset}
          region={region}
          setRegion={setRegion}
          onOpenRegionPickerModal={async () => {
            if (window.electronAPI?.selectRegion) {
              try { const selected = await window.electronAPI.selectRegion(); if (selected && !selected.cancelled) setRegion(selected); }
              catch (error) { showToast(error instanceof Error ? error.message : 'Region selection failed'); }
            } else setIsRegionPickerOpen(true);
          }}
          selectedWindowId={selectedWindowId}
          setSelectedWindowId={setSelectedWindowId}
        />

        {/* Section 2: Quality & Framerate */}
        <QualitySettings
          lang={lang}
          resolution={resolution}
          setResolution={setResolution}
          fps={fps}
          setFps={setFps}
        />

        {/* Section 3: Save Location & Next File (Direct path edit + sequential switch) */}
        <StorageAndNaming
          lang={lang}
          storage={storage}
          setStorage={setStorage}
        />

        {/* Section 4: Big Start Recording Button */}
        <div className="pt-2 w-full min-w-0">
          <button
            type="button"
            onClick={() => handleStartRecording()}
            className="w-full py-3.5 px-6 bg-[#D85631] hover:bg-[#C24623] active:scale-[0.99] text-white text-base font-bold rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center gap-2.5 cursor-pointer truncate"
          >
            <CircleDot className="w-5 h-5 fill-current shrink-0" />
            <span className="truncate">{t.startRecording}</span>
          </button>
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1E1D1B] text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-3 duration-150">
          <CheckCircle2 className="w-4 h-4 text-[#D85631] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        lang={lang}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        toggles={toggles}
        setToggles={setToggles}
        storage={storage}
        setStorage={setStorage}
        sharpness={sharpness}
        setSharpness={setSharpness}
        videoFormat={videoFormat}
        setVideoFormat={setVideoFormat}
      />

      {/* Interactive Region Selector Modal */}
      <InteractiveRegionSelector
        isOpen={isRegionPickerOpen}
        onClose={() => setIsRegionPickerOpen(false)}
        currentRegion={region}
        onApplyRegion={(newRegion) => {
          setRegion(newRegion);
          showToast(
            lang === 'en'
              ? `Region set to ${newRegion.width} × ${newRegion.height}`
              : `تم تحديد الأبعاد: ${newRegion.width} × ${newRegion.height}`
          );
        }}
      />

      {/* Live Recording Overlay (With hide/show bar logic & trash icon hide) */}
      {(!isElectron || recordingStatus === 'countdown') && <LiveRecordingOverlay
        lang={lang}
        isActive={recordingStatus !== 'idle'}
        status={recordingStatus}
        timerFormatted={formatTimer(recordingSeconds)}
        secondsElapsed={recordingSeconds}
        countdownValue={countdownValue}
        storage={storage}
        toggles={toggles}
        region={region}
        captureMode={captureMode}
        onPauseResume={handlePauseResume}
        onSave={() => handleStopAndSave()}
        onTakeSnapshot={handleTakeSnapshot}
        onShowToast={showToast}
      />}
    </div>
  );
}
