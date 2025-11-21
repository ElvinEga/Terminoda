import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Icons } from "@/components/ui/icons"
import { useSettings } from "@/context/SettingsContext"
import { Switch } from "@/components/ui/switch"
import { getVersion } from "@tauri-apps/api/app"

export function SettingsView() {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState("general");
  const [appVersion, setAppVersion] = useState("1.0.0");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("Unknown"));
  }, []);

  const tabs = [
    { id: "general", label: "General", icon: Icons.Settings },
    { id: "appearance", label: "Appearance", icon: Icons.Zap },
    { id: "terminal", label: "Terminal", icon: Icons.Terminal },
    { id: "sftp", label: "SFTP", icon: Icons.Folder },
    { id: "shortcuts", label: "Shortcuts", icon: Icons.Command },
  ]

  return (
    <div className="flex h-full w-full bg-[#050505] text-zinc-200">
      {/* Settings Sidebar */}
      <div className="w-64 py-8 pr-8 border-r border-white/5">
        <h2 className="text-xl font-bold text-white mb-6 px-4">Settings</h2>
        <div className="space-y-1 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mt-auto pt-8 px-6 text-xs text-zinc-600 font-mono">
            v{appVersion}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 py-8 pl-8 overflow-y-auto">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-8 max-w-3xl"
        >
          {activeTab === "general" && (
            <section className="space-y-4">
              <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Application</h3>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Startup Behavior</div>
                  <div className="text-xs text-zinc-500">Choose what happens when the app starts</div>
                </div>
                <select disabled className="bg-zinc-900 border border-white/10 rounded-md text-sm text-zinc-500 px-3 py-1.5 focus:outline-none cursor-not-allowed">
                  <option>Show Dashboard</option>
                </select>
              </div>
            </section>
          )}

          {activeTab === "appearance" && (
            <section className="space-y-6">
              <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Theme</h3>
              <div className="grid grid-cols-3 gap-4">
                {["dark", "light", "system"].map((theme) => (
                  <div
                    key={theme}
                    onClick={() => updateSettings({ theme: theme as any })}
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${
                      settings.theme === theme ? "border-white bg-white/5" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className="aspect-video rounded-lg bg-zinc-900 mb-3 border border-white/5 relative overflow-hidden">
                      {theme === "dark" && <div className="absolute inset-0 bg-black/80" />}
                      {theme === "light" && <div className="absolute inset-0 bg-white" />}
                      {theme === "system" && <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-white" />}
                    </div>
                    <div className="text-sm font-medium text-center text-zinc-300 capitalize">{theme}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "terminal" && (
             <section className="space-y-6">
                <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Terminal</h3>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Font Size</div>
                    <div className="text-xs text-zinc-500">Controls the text size in the terminal</div>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-lg p-1">
                      <button 
                        onClick={() => updateSettings({ terminalFontSize: Math.max(8, settings.terminalFontSize - 1) })}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                      >-</button>
                      <span className="w-8 text-center font-mono text-sm">{settings.terminalFontSize}</span>
                      <button 
                        onClick={() => updateSettings({ terminalFontSize: Math.min(32, settings.terminalFontSize + 1) })}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                      >+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Bell Sound</div>
                    <div className="text-xs text-zinc-500">Play a sound when the bell character is received</div>
                  </div>
                  <Switch checked={settings.bellSound} onCheckedChange={(c) => updateSettings({ bellSound: c })} />
                </div>

                <div className="flex items-center justify-between py-2">
                    <div>
                        <div className="text-sm font-medium text-zinc-200">Emulation</div>
                    </div>
                    <select 
                        value={settings.terminalEmulation}
                        onChange={(e) => updateSettings({ terminalEmulation: e.target.value })}
                        className="bg-zinc-900 border border-white/10 rounded-md text-sm text-zinc-300 px-3 py-1.5 focus:outline-none focus:border-white/30"
                    >
                        <option value="xterm-256color">xterm-256color</option>
                        <option value="xterm">xterm</option>
                        <option value="vt100">vt100</option>
                    </select>
                </div>
             </section>
          )}

          {activeTab === "sftp" && (
            <section className="space-y-6">
                <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">SFTP</h3>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Show Hidden Files</div>
                    <div className="text-xs text-zinc-500">Display files starting with a dot (.)</div>
                  </div>
                  <Switch checked={settings.sftpShowHiddenFiles} onCheckedChange={(c) => updateSettings({ sftpShowHiddenFiles: c })} />
                </div>
            </section>
          )}
          
          {activeTab === "shortcuts" && (
             <section className="space-y-4">
                 <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Shortcuts</h3>
                 {[
                     { k: "Ctrl + F", d: "Find in Terminal" },
                     { k: "Ctrl + Shift + C", d: "Copy Selection" },
                     { k: "Ctrl + Shift + V", d: "Paste" },
                 ].map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-zinc-900/30 border border-white/5 rounded-lg">
                        <span className="text-sm text-zinc-400">{s.d}</span>
                        <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-zinc-300">{s.k}</kbd>
                    </div>
                 ))}
             </section>
          )}

        </motion.div>
      </div>
    </div>
  )
}
