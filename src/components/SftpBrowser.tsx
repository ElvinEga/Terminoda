import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Icons } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/SettingsContext";

interface SftpFile {
  name: string;
  is_dir: boolean;
  size: number;
  permissions: string;
  modified: number;
}

interface SftpBrowserProps {
  sessionId: string;
}

interface TransferState {
  filePath: string;
  transferredBytes: number;
  totalBytes: number;
  type: "upload" | "download";
}

interface TransferProgressPayload {
  session_id: string;
  file_path: string;
  transferred_bytes: number;
  total_bytes: number;
}

export function SftpBrowser({ sessionId }: SftpBrowserProps) {
  const { settings } = useSettings();
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SftpFile | null>(null);
  const [transferState, setTransferState] = useState<TransferState | null>(null);

  // Dialog States
  const [isMkdirOpen, setIsMkdirOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isPermOpen, setIsPermOpen] = useState(false);
  const [permValue, setPermValue] = useState("755");
  const [fileToEdit, setFileToEdit] = useState<SftpFile | null>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<SftpFile[]>("list_directory", { sessionId, path: currentPath });
      setFiles(result);
    } catch (error) {
      const errorMsg = typeof error === "string" ? error : String(error);
      toast.error(`Failed to list directory: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [sessionId, currentPath]);

  useEffect(() => {
    const unlistenPromise = listen<TransferProgressPayload>("transfer-progress", (event) => {
      if (event.payload.session_id !== sessionId) return;
      setTransferState((prev) => {
        if (!prev) return prev;
        const isSameFile = prev.filePath === event.payload.file_path || prev.filePath.endsWith(event.payload.file_path);
        if (!isSameFile) return prev;
        return {
          ...prev,
          transferredBytes: event.payload.transferred_bytes,
          totalBytes: event.payload.total_bytes || prev.totalBytes,
        };
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [sessionId]);

  const handleNavigate = (fileName: string) => {
    const newPath = currentPath === "/" ? `/${fileName}` : `${currentPath}/${fileName}`;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? "/" + parts.join("/") : "/");
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const getFullPath = (name: string) => {
    return currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
  };

  const visibleFiles = files.filter(file => {
    if (settings.sftpShowHiddenFiles) return true;
    return !file.name.startsWith('.');
  });

  // --- Actions ---

  const handleCreateDirectory = async () => {
    if (!newFolderName) return;
    const path = getFullPath(newFolderName);
    try {
        await invoke("create_directory", { sessionId, path });
        toast.success("Folder created");
        setNewFolderName("");
        setIsMkdirOpen(false);
        fetchFiles();
    } catch (e) {
        toast.error(`Failed to create folder: ${e}`);
    }
  };

  const handleDelete = async (file: SftpFile) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
    const path = getFullPath(file.name);
    try {
        await invoke("delete_item", { sessionId, path, isDir: file.is_dir });
        toast.success("Item deleted");
        fetchFiles();
    } catch (e) {
        toast.error(`Failed to delete: ${e}`);
    }
  };

  const handleRename = async () => {
    if (!fileToEdit || !renameValue || renameValue === fileToEdit.name) return;
    const oldPath = getFullPath(fileToEdit.name);
    const newPath = getFullPath(renameValue);
    
    try {
        await invoke("rename_item", { sessionId, oldPath, newPath });
        toast.success("Renamed successfully");
        setIsRenameOpen(false);
        setFileToEdit(null);
        fetchFiles();
    } catch (e) {
        toast.error(`Rename failed: ${e}`);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile || selectedFile.is_dir) {
      toast.warning("Select a file to download");
      return;
    }

    const localPath = await save({ defaultPath: selectedFile.name });
    if (!localPath) return;

    const remotePath = getFullPath(selectedFile.name);
    setTransferState({
      filePath: remotePath,
      transferredBytes: 0,
      totalBytes: selectedFile.size,
      type: "download",
    });

    toast.promise(
      invoke("download_file", {
        sessionId,
        remotePath,
        localPath,
      }),
      {
        loading: `Downloading ${selectedFile.name}...`,
        success: () => {
          setTransferState(null);
          return `${selectedFile.name} downloaded`;
        },
        error: (err) => {
          setTransferState(null);
          return typeof err === "string" ? err : "Download failed";
        },
      }
    );
  };

  const handleUpload = async () => {
    const localPath = await open({ multiple: false });
    if (!localPath || Array.isArray(localPath)) return;

    const fileName = localPath.split(/[/\\]/).pop();
    if (!fileName) {
      toast.error("Unable to detect filename");
      return;
    }

    const remotePath = getFullPath(fileName);
    setTransferState({
      filePath: localPath,
      transferredBytes: 0,
      totalBytes: 0,
      type: "upload",
    });

    toast.promise(
      invoke("upload_file", {
        sessionId,
        localPath,
        remotePath,
      }),
      {
        loading: `Uploading ${fileName}...`,
        success: () => {
          setTransferState(null);
          fetchFiles();
          return `${fileName} uploaded`;
        },
        error: (err) => {
          setTransferState(null);
          return typeof err === "string" ? err : "Upload failed";
        },
      }
    );
  };

  const handleChmod = async () => {
    if (!fileToEdit || !permValue) return;
    
    const mode = parseInt(permValue, 8);
    if (isNaN(mode)) {
        toast.error("Invalid permissions format. Use octal (e.g., 755)");
        return;
    }

    const path = getFullPath(fileToEdit.name);
    
    try {
        await invoke("chmod_item", { sessionId, path, mode });
        toast.success("Permissions updated");
        setIsPermOpen(false);
        setFileToEdit(null);
        fetchFiles();
    } catch (e) {
        toast.error(`Chmod failed: ${e}`);
    }
  };

  const openPermDialog = (file: SftpFile) => {
      setFileToEdit(file);
      setPermValue(file.is_dir ? "755" : "644");
      setIsPermOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-background/20">
      {/* Toolbar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-accent/50">
        <div className="flex items-center gap-2 flex-1 mr-4">
           <button 
             onClick={handleGoUp} 
             disabled={currentPath === "/"}
             className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
           >
             <Icons.ChevronRight className="w-4 h-4 rotate-180" />
           </button>
           <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-background/30 border border-border rounded text-xs font-mono text-muted-foreground">
             <span className="text-primary">sftp://</span>
             {currentPath}
           </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMkdirOpen(true)}
            className="p-2 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title="New Folder"
          >
            <Icons.Plus className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-border mx-1" />
          <button onClick={handleUpload} className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded text-xs font-medium text-foreground transition-colors">
            <Icons.Upload className="w-3 h-3" /> Upload
          </button>
          <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 bg-accent hover:bg-accent/80 rounded text-xs font-medium text-foreground transition-colors">
            <Icons.Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>

      {/* Transfer Progress */}
      {transferState && (
          <div className="h-1 w-full bg-muted overflow-hidden">
             <div 
               className="h-full bg-primary transition-all duration-300"
               style={{ width: `${(transferState.transferredBytes / Math.max(1, transferState.totalBytes)) * 100}%` }}
             />
          </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
            <tr>
              <th className="p-2 pl-4 font-medium">Name</th>
              <th className="p-2 font-medium w-24">Size</th>
              <th className="p-2 font-medium w-32">Permissions</th>
              <th className="p-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
               <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : visibleFiles.length === 0 ? (
               <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Empty Directory</td></tr>
            ) : (
               visibleFiles.map((file) => (
                 <tr 
                    key={file.name} 
                    className="hover:bg-accent group transition-colors cursor-pointer"
                    onDoubleClick={() => file.is_dir && handleNavigate(file.name)}
                    onClick={() => setSelectedFile(file)}
                 >
                    <td className="p-2 pl-4 flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                        {file.is_dir ? (
                            <Icons.Folder className="w-4 h-4 text-primary fill-primary/20" />
                        ) : (
                            <div className="w-4 h-4 flex items-center justify-center">
                                <div className="w-3 h-4 bg-muted-foreground/50 rounded-[1px]" />
                            </div>
                        )}
                        <span className="truncate">{file.name}</span>
                    </td>
                    <td className="p-2 text-muted-foreground font-mono">{file.is_dir ? '-' : formatBytes(file.size)}</td>
                    <td className="p-2 text-muted-foreground font-mono">{file.permissions}</td>
                    <td className="p-2 text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                                    <Icons.More className="w-3 h-3" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground">
                                <DropdownMenuItem onClick={() => { setFileToEdit(file); setRenameValue(file.name); setIsRenameOpen(true); }}>
                                    Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPermDialog(file)}>
                                    Permissions
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(file)}>
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </td>
                 </tr>
               ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialogs (Mkdir / Rename) - reuse logic, ensure dark styling */}
      <Dialog open={isMkdirOpen} onOpenChange={setIsMkdirOpen}>
        <DialogContent className="bg-background border-border text-foreground">
             <DialogHeader><DialogTitle>New Folder</DialogTitle></DialogHeader>
             <Input 
                value={newFolderName} 
                onChange={e => setNewFolderName(e.target.value)} 
                className="bg-input border-border"
                placeholder="Folder Name"
             />
             <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsMkdirOpen(false)}>Cancel</Button>
                 <Button onClick={handleCreateDirectory} className="bg-primary text-primary-foreground hover:bg-primary/90">Create</Button>
             </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="bg-background border-border text-foreground">
             <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
             <Input 
                value={renameValue} 
                onChange={e => setRenameValue(e.target.value)} 
                className="bg-input border-border"
             />
             <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                 <Button onClick={handleRename} className="bg-primary text-primary-foreground hover:bg-primary/90">Save</Button>
             </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPermOpen} onOpenChange={setIsPermOpen}>
        <DialogContent className="bg-background border-border text-foreground">
             <DialogHeader><DialogTitle>Change Permissions</DialogTitle></DialogHeader>
             <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Octal Mode (e.g., 755, 644)</label>
                <Input 
                    value={permValue} 
                    onChange={(e) => setPermValue(e.target.value)} 
                    className="bg-input border-border"
                    maxLength={4}
                />
             </div>
             <DialogFooter>
                 <Button variant="ghost" onClick={() => setIsPermOpen(false)}>Cancel</Button>
                 <Button onClick={handleChmod} className="bg-primary text-primary-foreground hover:bg-primary/90">Apply</Button>
             </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
