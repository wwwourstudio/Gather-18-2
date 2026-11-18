import React from 'react';
import { FileText, Volume2 } from 'lucide-react';
import { AiCueTab } from './console/AiCueTab';
import { ChatTab } from './console/ChatTab';
import { ConsoleTab, RightConsoleProps } from './console/consoleTypes';
import { LookTab } from './console/LookTab';
import { ShopTab } from './console/ShopTab';
import { ShowTab } from './console/ShowTab';

export type { ConsoleTab, RightConsoleProps };

const PANEL_HEADERS: Record<ConsoleTab, { title: string; subtitle: string }> = {
  chat: { title: 'Chat & Q&A', subtitle: 'Moderation, replies, pinning & audience Q&A' },
  ai: { title: 'Cue AI', subtitle: 'Live showrunner, Auto-Director & stage cues' },
  show: { title: 'Show', subtitle: 'Banners, captions, stage HUD & rundown' },
  shop: { title: 'Payouts & Drops', subtitle: '0%-fee direct tips & optional live catalog' },
  look: { title: 'Look & Brand', subtitle: 'Stream format, overlays, sponsors & look' },
};

export const RightConsole: React.FC<RightConsoleProps> = ({
  room,
  isHost,
  actorId = 'studio-host',
  open,
  activeTab,
  aiLogs,
  aiBusy,
  aiVoiceReadout,
  autoDirectorEnabled,
  autoDirectorSensitivity,
  autoDirectorAnalyzing,
  autoDirectorLogs,
  onToggleAutoDirector,
  onChangeAutoDirectorSensitivity,
  onTriggerAutoDirector,
  onApproveAutoSuggestion,
  onDismissAutoSuggestion,
  onToggleAiVoiceReadout,
  onAskAi,
  onPushAiToStage,
  onGenerateShowNotes,
  onPatchRoom,
  onSendChat,
  onToggleChatLike,
  onToggleChatReaction,
  onPinChatMessage,
  onDeleteChatMessage,
  onBlockChatUser,
  onUnblockChatUser,
  onFeatureChat,
  onFeatureQuestion,
  onPinProduct,
  onStartFlashSale,
  onStopFlashSale,
  onLaunchPoll,
  onClosePoll,
  onRunRundownStep,
  onToggleCaptions,
  onSelectBrandFile,
  brandKits,
  onApplyBrandKit,
  onSaveBrandKit,
  onOpenAiStudio,
  onNotify,
}) => {
  if (!open) return null;

  const header = PANEL_HEADERS[activeTab];

  return (
    <aside className="w-full h-full min-w-0 min-h-0 flex flex-col overflow-hidden bg-transparent">
      <header className="px-4 py-3 border-b border-[var(--line)] shrink-0 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[14.5px] font-medium text-[var(--ink)] leading-tight tracking-[-0.015em]">
            {header.title}
          </h2>
          <p className="text-[11px] text-[var(--ink-3)] mt-0.5 truncate">{header.subtitle}</p>
        </div>
        {activeTab === 'ai' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleAiVoiceReadout}
              title="Speak AI replies aloud"
              className={`h-7 px-2 rounded-[6px] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                aiVoiceReadout
                  ? 'gather-btn-primary text-white'
                  : 'bg-[var(--fill)] text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              <Volume2 className="w-3 h-3" />
              <span>Voice</span>
            </button>
            <button
              type="button"
              onClick={onGenerateShowNotes}
              title="Export Markdown Show Notes"
              className="h-7 px-2 rounded-[6px] bg-[var(--fill)] hover:bg-[var(--fill-hover)] text-[11px] font-medium text-[var(--ink-2)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3 h-3" />
              <span>Notes</span>
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto gather-scroll p-3.5 space-y-4">
        {activeTab === 'show' && (
          <ShowTab
            room={room}
            isHost={isHost}
            onPatchRoom={onPatchRoom}
            onLaunchPoll={onLaunchPoll}
            onClosePoll={onClosePoll}
            onRunRundownStep={onRunRundownStep}
            onToggleCaptions={onToggleCaptions}
          />
        )}

        {activeTab === 'chat' && (
          <ChatTab
            room={room}
            isHost={isHost}
            actorId={actorId}
            onSendChat={onSendChat}
            onToggleChatLike={onToggleChatLike}
            onToggleChatReaction={onToggleChatReaction}
            onPinChatMessage={onPinChatMessage}
            onDeleteChatMessage={onDeleteChatMessage}
            onBlockChatUser={onBlockChatUser}
            onUnblockChatUser={onUnblockChatUser}
            onFeatureChat={onFeatureChat}
            onFeatureQuestion={onFeatureQuestion}
          />
        )}

        {activeTab === 'shop' && (
          <ShopTab
            room={room}
            onPatchRoom={onPatchRoom}
            onPinProduct={onPinProduct}
            onStartFlashSale={onStartFlashSale}
            onStopFlashSale={onStopFlashSale}
            brandKits={brandKits}
            onApplyBrandKit={onApplyBrandKit}
            onSaveBrandKit={onSaveBrandKit}
            onOpenAiStudio={onOpenAiStudio}
            onNotify={onNotify}
          />
        )}

        {activeTab === 'ai' && (
          <AiCueTab
            room={room}
            isHost={isHost}
            aiLogs={aiLogs}
            aiBusy={aiBusy}
            autoDirectorEnabled={autoDirectorEnabled}
            autoDirectorSensitivity={autoDirectorSensitivity}
            autoDirectorAnalyzing={autoDirectorAnalyzing}
            autoDirectorLogs={autoDirectorLogs}
            onToggleAutoDirector={onToggleAutoDirector}
            onChangeAutoDirectorSensitivity={onChangeAutoDirectorSensitivity}
            onTriggerAutoDirector={onTriggerAutoDirector}
            onApproveAutoSuggestion={onApproveAutoSuggestion}
            onDismissAutoSuggestion={onDismissAutoSuggestion}
            onAskAi={onAskAi}
            onPushAiToStage={onPushAiToStage}
          />
        )}

        {activeTab === 'look' && (
          <LookTab
            room={room}
            onPatchRoom={onPatchRoom}
            onSelectBrandFile={onSelectBrandFile}
            brandKits={brandKits}
            onApplyBrandKit={onApplyBrandKit}
            onSaveBrandKit={onSaveBrandKit}
            onOpenAiStudio={onOpenAiStudio}
            onNotify={onNotify}
          />
        )}
      </div>
    </aside>
  );
};
