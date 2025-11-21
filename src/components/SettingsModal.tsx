import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/context/SettingsContext";
import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { cn } from "@/lib/utils";
import { Minus, Plus, User, Command, Info, FolderCog, Users } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const [activeSection, setActiveSection] = useState("Terminal");
  const [appVersion, setAppVersion] = useState("1.0.0");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("Unknown"));
  }, []);

  const sections = [
    "Account",
    "Invite People",
    "Terminal",
    "SFTP",
    "Shortcuts",
    "Theme",
    "About",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-5xl p-0 gap-0 h-[80vh] bg-[#f4f4f5] dark:bg-[#1e1f29] overflow-hidden border-none text-foreground">
        <div className="flex h-full">
          
          {/* Left Sidebar */}
          <div className="w-64 bg-white dark:bg-[#2b2d3b] border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-6 pb-4">
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className={cn(
                    "w-full text-left px-6 py-2 text-sm font-medium transition-colors",
                    activeSection === section
                      ? "bg-gray-100 dark:bg-[#343746] text-blue-600 dark:text-blue-400 border-r-2 border-blue-500"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#343746]/50"
                  )}
                >
                  {section}
                </button>
              ))}
            </div>
            <div className="p-6 text-xs text-gray-400">
              <p>Terminoda v{appVersion}</p>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-[#1e1f29] p-8">
            
            {/* --- ACCOUNT --- */}
            {activeSection === "Account" && (
              <div className="max-w-xl mx-auto text-center mt-20">
                <div className="bg-gray-200 dark:bg-[#2a2b3d] h-24 w-24 rounded-full mx-auto flex items-center justify-center mb-4">
                    <User className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold">Local User</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Syncing features are currently disabled.</p>
                <Button disabled>Sign In / Register</Button>
              </div>
            )}

            {/* --- INVITE --- */}
            {activeSection === "Invite People" && (
               <div className="max-w-xl mx-auto text-center mt-20">
                  <Users className="h-16 w-16 mx-auto text-blue-500 mb-4" />
                  <h3 className="text-xl font-semibold">Collaborate</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Team features like shared vaults and snippet libraries are coming soon.
                  </p>
               </div>
            )}

            {/* --- TERMINAL --- */}
            {activeSection === "Terminal" && (
              <div className="space-y-6 max-w-3xl mx-auto">
                <div className="bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4">Terminal settings</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Auto-reconnect</span>
                      <Switch 
                        checked={settings.autoConnect} 
                        onCheckedChange={(c) => updateSettings({ autoConnect: c })} 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Bell sound</span>
                      <Switch 
                        checked={settings.bellSound}
                        onCheckedChange={(c) => updateSettings({ bellSound: c })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Terminal emulation type</span>
                      <Select 
                        value={settings.terminalEmulation} 
                        onValueChange={(v) => updateSettings({ terminalEmulation: v })}
                      >
                        <SelectTrigger className="w-[180px] h-8">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xterm-256color">xterm-256color</SelectItem>
                          <SelectItem value="xterm">xterm</SelectItem>
                          <SelectItem value="vt100">vt100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                  <h3 className="text-sm font-semibold mb-4">Typography</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Font Family</label>
                      <Input 
                        value={settings.terminalFontFamily}
                        onChange={(e) => updateSettings({ terminalFontFamily: e.target.value })}
                        className="bg-transparent" 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Text Size</span>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" size="icon" className="h-8 w-8"
                          onClick={() => updateSettings({ terminalFontSize: Math.max(8, settings.terminalFontSize - 1) })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <div className="w-12 text-center text-sm font-mono bg-white dark:bg-[#191a21] border rounded-md py-1">
                          {settings.terminalFontSize}
                        </div>
                        <Button 
                          variant="outline" size="icon" className="h-8 w-8"
                          onClick={() => updateSettings({ terminalFontSize: Math.min(32, settings.terminalFontSize + 1) })}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SFTP --- */}
            {activeSection === "SFTP" && (
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <FolderCog className="h-4 w-4" /> SFTP Browser
                        </h3>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Show hidden files (dotfiles)</span>
                            <Switch 
                                checked={settings.sftpShowHiddenFiles}
                                onCheckedChange={(c) => updateSettings({ sftpShowHiddenFiles: c })}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- SHORTCUTS --- */}
            {activeSection === "Shortcuts" && (
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#343746]">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Command className="h-4 w-4" /> Keyboard Shortcuts
                            </h3>
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                            {[
                                { action: "Find in Terminal", keys: "Ctrl + F" },
                                { action: "Copy (Selection)", keys: "Ctrl + Shift + C" },
                                { action: "Paste", keys: "Ctrl + Shift + V" },
                                { action: "Toggle Snippets", keys: "Click Icon" },
                                { action: "Close Tab", keys: "Click X" },
                            ].map((s, i) => (
                                <div key={i} className="flex justify-between p-4 text-sm">
                                    <span>{s.action}</span>
                                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-[#191a21] rounded border border-gray-200 dark:border-gray-600 font-mono text-xs">
                                        {s.keys}
                                    </kbd>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- THEME --- */}
            {activeSection === "Theme" && (
               <div className="max-w-3xl mx-auto bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                <h3 className="text-sm font-semibold mb-4">Appearance</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Application Theme</span>
                  <Select 
                    value={settings.theme} 
                    onValueChange={(v: any) => updateSettings({ theme: v })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
               </div>
            )}

            {/* --- ABOUT --- */}
            {activeSection === "About" && (
                <div className="max-w-xl mx-auto text-center mt-10">
                    <div className="bg-blue-600 p-4 rounded-2xl inline-block mb-4 shadow-lg shadow-blue-900/20">
                        <Info className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Terminoda</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        A modern, cross-platform SSH client built with Tauri, React, and Rust.
                    </p>
                    
                    <div className="bg-white dark:bg-[#2b2d3b] rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left text-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Version</span>
                            <span className="font-mono">{appVersion}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">License</span>
                            <span>MIT</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Backend</span>
                            <span>Rust (Tauri)</span>
                        </div>
                    </div>
                    
                    <p className="mt-8 text-xs text-gray-400">
                        © 2024 Terminoda Project. All rights reserved.
                    </p>
                </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
