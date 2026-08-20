import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type StoredProjectAccess = { projectId: string; accessKey: string; projectName: string };

function storageKey(scope: string) { return `cad_ai_project_access_${scope.replace(/[^a-zA-Z0-9_-]/g, "_")}`; }

export async function loadProjectAccess(scope: string): Promise<StoredProjectAccess | null> {
  const key = storageKey(scope);
  const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredProjectAccess; } catch { return null; }
}

export async function saveProjectAccess(scope: string, project: StoredProjectAccess): Promise<void> {
  const key = storageKey(scope); const value = JSON.stringify(project);
  if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export async function clearProjectAccess(scope: string): Promise<void> {
  const key = storageKey(scope);
  if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}
