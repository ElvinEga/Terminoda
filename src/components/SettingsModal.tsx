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
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const [activeSection, setActiveSection] = useState("Terminal");

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
      <DialogContent className="max-w-5xl p-0 gap-0 h-[80vh] bg-[#f4f4f5] dark:bg-[#1e1f29] overflow-hidden border-none text-foreground">
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
            {/* Footer Info */}
            <div className="p-6 text-xs text-gray-400">
              <p>Version 1.0.0</p>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto bg-[#f9fafb] dark:bg-[#1e1f29] p-8">
            {activeSection === "Terminal" && (
              <div className="space-y-6 max-w-3xl mx-auto">
                
                {/* Terminal Settings Card */}
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
                      <Select defaultValue="xterm-256color">
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

                {/* Font Settings Card */}
                <div className="bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
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
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => updateSettings({ terminalFontSize: Math.max(8, settings.terminalFontSize - 1) })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <div className="w-12 text-center text-sm font-mono bg-white dark:bg-[#191a21] border rounded-md py-1">
                          {settings.terminalFontSize}
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8"
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

            {activeSection === "Theme" && (
               <div className="bg-white dark:bg-[#2b2d3b] rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
