import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderOpen, Settings2, X, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SavedHost } from "./VaultSidebar"

const formSchema = z.object({
  name: z.string().min(1, "Host name is required"),
  group: z.string().optional(),
  tags: z.array(z.string()).optional(),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().min(1, "Port must be valid").min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  authMethod: z.enum(["password", "key"]).default("password"),
  password: z.string().optional(),
  private_key_path: z.string().optional(),
  passphrase: z.string().optional(),
  keepalive_interval: z.coerce.number().nonnegative().default(60),
  timeout: z.coerce.number().nonnegative().default(10000),
}).refine((data) => {
  if (data.authMethod === "password" && !data.password) return false;
  if (data.authMethod === "key" && !data.private_key_path) return false;
  return true;
}, {
  message: "Password or Private Key is required",
  path: ["password"],
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectionDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (host: SavedHost, isEditing: boolean) => void;
  editingHost: SavedHost | null;
}

export function ConnectionDialog({ isOpen, setIsOpen, onSave, editingHost }: ConnectionDialogProps) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [customGroup, setCustomGroup] = useState("");
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      group: "Development",
      tags: [],
      host: "",
      port: 22,
      username: "",
      authMethod: "password",
      password: "",
      private_key_path: "",
      passphrase: "",
      keepalive_interval: 60,
      timeout: 10000,
    },
  });

  const isEditing = !!editingHost;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && editingHost) {
        const group = editingHost.group || "Development";
        const isCustom = !["Development", "Staging", "Production"].includes(group);
        setIsCustomGroup(isCustom);
        if (isCustom) setCustomGroup(group);
        
        setTags(editingHost.tags || []);
        
        form.reset({
          name: editingHost.name,
          group: isCustom ? "custom" : group,
          tags: editingHost.tags || [],
          ...editingHost.details,
          keepalive_interval: editingHost.details.keepalive_interval ?? 60,
          timeout: editingHost.details.timeout ?? 10000,
          authMethod: editingHost.details.private_key_path ? "key" : "password",
        });
      } else {
        setTags([]);
        setIsCustomGroup(false);
        setCustomGroup("");
        form.reset({
          name: "",
          group: "Development",
          tags: [],
          host: "",
          port: 22,
          username: "",
          authMethod: "password",
          password: "",
          private_key_path: "",
          passphrase: "",
          keepalive_interval: 60,
          timeout: 10000,
        });
      }
      setSaveError(null);
    }
  }, [isOpen, editingHost, form, isEditing]);

  const handleFileSelect = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'SSH Keys', extensions: ['pem', 'key', 'pub', ''] }],
    });
    if (selected && typeof selected === 'string') {
      form.setValue("private_key_path", selected);
    }
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      const updatedTags = [...tags, newTag];
      setTags(updatedTags);
      form.setValue("tags", updatedTags);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    setTags(updatedTags);
    form.setValue("tags", updatedTags);
  };

  async function onSubmit(values: FormValues) {
    setSaveError(null);
    let { name, group, authMethod, ...baseDetails } = values;
    
    if (group === "custom") {
        group = customGroup;
    }

    const details = {
      ...baseDetails,
      password: authMethod === "password" ? baseDetails.password : undefined,
      private_key_path: authMethod === "key" ? baseDetails.private_key_path : undefined,
      passphrase: authMethod === "key" ? baseDetails.passphrase : undefined,
      keepalive_interval: baseDetails.keepalive_interval,
      timeout: baseDetails.timeout,
    };

    try {
      const savedHost = isEditing && editingHost
        ? await invoke<SavedHost>("update_host", { updatedHost: { id: editingHost.id, name, group, tags, details } })
        : await invoke<SavedHost>("save_new_host", { name, group, tags, details });
      
      if (isEditing && editingHost) {
          onSave({ id: editingHost.id, name, group, tags, details }, true);
      } else {
          onSave(savedHost, false);
      }
      
      setIsOpen(false);
      toast.success(isEditing ? "Connection updated" : "Connection saved");
    } catch (error) {
      console.error("Failed to save host:", error);
      setSaveError(typeof error === "string" ? error : "Failed to save connection");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] bg-[#0A0A0A] border-white/10 text-zinc-200">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Connection" : "New Connection"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update host details." : "Enter host details and choose authentication method."}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="flex gap-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem className="flex-grow">
                    <FormLabel>Host Name</FormLabel>
                    <FormControl>
                        <Input placeholder="My Server" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                
                <div className="w-1/3 space-y-2">
                    <FormField
                    control={form.control}
                    name="group"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Group</FormLabel>
                        <Select onValueChange={(val) => {
                            field.onChange(val);
                            setIsCustomGroup(val === "custom");
                        }} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Development">Development</SelectItem>
                                <SelectItem value="Staging">Staging</SelectItem>
                                <SelectItem value="Production">Production</SelectItem>
                                <SelectItem value="custom">Custom...</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    {isCustomGroup && (
                        <Input 
                            placeholder="Custom Group Name" 
                            value={customGroup} 
                            onChange={(e) => setCustomGroup(e.target.value)}
                            className="h-8 mt-1"
                        />
                    )}
                </div>
            </div>

            {/* Tags Input */}
            <div className="space-y-2">
                <FormLabel>Tags</FormLabel>
                <div className="flex gap-2">
                    <Input 
                        placeholder="Add a tag (e.g. aws, db)" 
                        value={newTag} 
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addTag();
                            }
                        }}
                    />
                    <Button type="button" variant="secondary" onClick={addTag} size="icon">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map(tag => (
                        <div key={tag} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md text-xs flex items-center gap-1">
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-white">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="22" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="root" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />



            <Tabs defaultValue="auth" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auth">Authentication</TabsTrigger>
                <TabsTrigger value="advanced" className="flex items-center gap-2">
                    <Settings2 className="h-3 w-3" /> Advanced
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="auth" className="space-y-4 mt-4">
                 <Tabs defaultValue={form.watch("authMethod")} onValueChange={(v) => form.setValue("authMethod", v as "password" | "key")}>
                    <TabsList className="grid w-full grid-cols-2 h-8">
                        <TabsTrigger value="password" className="text-xs">Password</TabsTrigger>
                        <TabsTrigger value="key" className="text-xs">Private Key</TabsTrigger>
                    </TabsList>
                    
                     <TabsContent value="password" className="space-y-3">
                        <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </TabsContent>
                    <TabsContent value="key" className="space-y-3">
                        <div className="flex gap-2 items-end">
                            <FormField
                                control={form.control}
                                name="private_key_path"
                                render={({ field }) => (
                                <FormItem className="flex-grow">
                                    <FormLabel>Key Path</FormLabel>
                                    <FormControl>
                                    <Input placeholder="/home/user/.ssh/id_rsa" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <Button type="button" variant="outline" onClick={handleFileSelect}>
                                <FolderOpen className="h-4 w-4" />
                            </Button>
                        </div>
                         <FormField
                            control={form.control}
                            name="passphrase"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Passphrase (Optional)</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="Key passphrase" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </TabsContent>
                 </Tabs>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="keepalive_interval"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Keep-Alive (Sec)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="timeout"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Timeout (ms)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 dark:bg-[#2a2b3d] p-2 rounded">
                    <p>Keep-Alive helps prevent the server from closing the connection due to inactivity.</p>
                </div>
              </TabsContent>
            </Tabs>

            {saveError && (
              <p className="text-sm font-medium text-red-500">
                {saveError}
              </p>
            )}
            
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : (isEditing ? "Update Connection" : "Save Connection")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
