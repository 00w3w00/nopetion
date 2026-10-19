import { useEffect, useRef, useState } from "react";
import {
  Alert, Anchor, Badge, Button, Checkbox, CopyButton, Group, Loader,
  PasswordInput, Paper, Select, Stack, Text, Textarea, TextInput, UnstyledButton,
} from "@mantine/core";
import { IconBrandGoogleDrive, IconBrandGithub, IconBrandNotion, IconCheck, IconCopy, IconExternalLink, IconPlugConnected, IconRefresh, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api-client";
import SettingsTitle from "@/components/settings/settings-title";
import { DocumentTitle } from "@/components/ui/document-title";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { createPage } from "@/features/page/services/page-service";
import { buildPageUrl } from "@/features/page/page.utils";
import { connectorInfo, normalizeConnectorSource, readGoogleClientJson, type ConnectorId, type ConnectorPreview, type ConnectorSource, type ConnectorStatus } from "./connector-config";
import classes from "./connector-settings.module.css";

const providers: ConnectorId[] = ["google-drive", "github", "notion"];
const icons = { "google-drive": IconBrandGoogleDrive, github: IconBrandGithub, notion: IconBrandNotion };
const post = async <T,>(path: string, body: unknown = {}): Promise<T> => (await api.post("/personal-connectors/" + path, body)).data as T;
const message = (error: any) => typeof error?.response?.data?.message === "string" ? error.response.data.message : error instanceof Error ? error.message : "Connection failed";

export default function ConnectorSettings() {
  const { t } = useTranslation(), [params] = useSearchParams();
  const initialProvider = params.get("provider") as ConnectorId;
  const [selected, setSelected] = useState<ConnectorId>(providers.includes(initialProvider) ? initialProvider : "google-drive");
  const query = useQuery({ queryKey: ["personal-connectors"], queryFn: () => post<ConnectorStatus[]>("status"), retry: false });
  const returned = query.data?.find(c => c.provider === initialProvider);
  const failure = params.get("reason") === "cancelled" ? "Authorization was cancelled. You can try logging in again." : params.get("reason") === "expired" ? "The login request expired. Start login again from this screen." : "OAuth connection failed. Check the client settings and try again.";
  return <div className={classes.page}>
    <DocumentTitle title={t("Connections")} /><SettingsTitle title={t("Connections")} />
    <Text c="dimmed" size="sm" className={classes.intro}>{t("Set up, connect and import from one place. Your original documents stay in the source service.")}</Text>
    <div className={classes.providers} role="group" aria-label={t("Choose a service")}>
      {providers.map(provider => {
        const Icon = icons[provider], connection = query.data?.find(c => c.provider === provider);
        return <UnstyledButton key={provider} className={classes.provider} data-active={selected === provider || undefined} aria-pressed={selected === provider} onClick={() => setSelected(provider)}>
          <Icon size={25} stroke={1.6} aria-hidden /><span className={classes.providerText}><strong>{connectorInfo[provider].name}</strong><small>{t(connection?.connected ? "Connected" : connection?.configured ? "App settings saved" : "Setup needed")}</small></span>
          {connection?.connected && <IconCheck size={17} aria-label={t("Connected")} />}
        </UnstyledButton>;
      })}
    </div>
    {params.get("result") === "failed" && <Alert color="red" title={t("Connection failed")} role="alert">{t(failure)}</Alert>}
    {params.get("result") === "connected" && returned?.connected && <Alert color="green" role="status">{t("Login completed. Verify the connection and choose a source to import.")}</Alert>}
    {query.isLoading && <Group justify="center" p="xl" role="status"><Loader size="sm" /><Text size="sm">{t("Loading connections…")}</Text></Group>}
    {query.isError && <Alert color="red" title={t("Could not load connections")} role="alert"><Button mt="xs" size="xs" variant="light" onClick={() => query.refetch()}>{t("Retry")}</Button></Alert>}
    {query.data?.map(connection => <Connection key={connection.provider} active={selected === connection.provider} connection={connection} refresh={async () => { await query.refetch(); }} />)}
  </div>;
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  return <div className={classes.copyField}><Text size="sm" fw={500}>{t(label)}</Text><div className={classes.copyRow}>
    <code>{value}</code><CopyButton value={value}>{({ copied, copy }) => <Button size="xs" variant="default" onClick={copy} aria-label={t("Copy") + " " + t(label)} leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>{t(copied ? "Copied" : "Copy")}</Button>}</CopyButton>
  </div></div>;
}

function Connection({ active, connection, refresh }: { active: boolean; connection: ConnectorStatus; refresh: () => Promise<void> }) {
  const { t, i18n } = useTranslation(), navigate = useNavigate(), info = connectorInfo[connection.provider];
  const spaces = useGetSpacesQuery({ limit: 100 });
  const [step, setStep] = useState(connection.connected ? 3 : connection.configured ? 2 : 1);
  const [clientId, setClientId] = useState(connection.clientId), [secret, setSecret] = useState(""), [privateRepos, setPrivateRepos] = useState(connection.privateRepos);
  const prior = useRef(connection), credentialsFile = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [success, setSuccess] = useState(""), [fileHint, setFileHint] = useState("");
  const [choices, setChoices] = useState<ConnectorSource[]>([]), [loadedSources, setLoadedSources] = useState(false), [sourceId, setSourceId] = useState("");
  const [preview, setPreview] = useState<ConnectorPreview | null>(null), [spaceId, setSpaceId] = useState<string | null>(null), [verifiedAt, setVerifiedAt] = useState(connection.verifiedAt);
  useEffect(() => {
    const old = prior.current;
    setClientId(value => value === old.clientId ? connection.clientId : value);
    setPrivateRepos(value => value === old.privateRepos ? connection.privateRepos : value);
    setVerifiedAt(connection.verifiedAt);
    if (!connection.connected) { setChoices([]); setLoadedSources(false); setPreview(null); }
    prior.current = connection;
  }, [connection]);
  const dirty = clientId.trim() !== connection.clientId || !!secret || privateRepos !== connection.privateRepos;
  const needsSecret = !connection.configured || clientId.trim() !== connection.clientId;
  const canSave = !!clientId.trim() && (!needsSecret || !!secret.trim());
  const run = async (action: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(action); setError(""); setSuccess("");
    try { await work(); } catch (cause) { setError(t(message(cause))); } finally { setBusy(""); }
  };
  const save = async () => {
    if (!canSave) throw Error("Client ID and secret are required");
    await post("configure", { provider: connection.provider, clientId: clientId.trim(), ...(secret.trim() ? { clientSecret: secret.trim() } : {}), privateRepos });
    setClientId(clientId.trim()); setSecret(""); setChoices([]); setLoadedSources(false); setPreview(null); await refresh();
  };
  const connect = () => run("connect", async () => {
    if (dirty || !connection.configured) await save();
    const result = await post<{ url: string }>("sign-in", { provider: connection.provider });
    // Server constructs a fixed provider URL; do not follow arbitrary input.
    const target = new URL(result.url), allowed = connection.provider === "github" ? "https://github.com" : connection.provider === "notion" ? "https://api.notion.com" : "https://accounts.google.com";
    if (target.origin !== allowed) throw Error("Connection failed");
    window.location.assign(target.href);
  });
  const verify = () => run("verify", async () => {
    const result = await post<{ sources: ConnectorSource[]; verifiedAt: string }>("verify", { provider: connection.provider });
    setChoices(result.sources); setLoadedSources(true); setVerifiedAt(result.verifiedAt); setStep(3);
    setSuccess("Connection verified. Choose a source below."); await refresh();
  });
  const load = () => run("sources", async () => {
    setChoices(await post<ConnectorSource[]>("choices", { provider: connection.provider })); setLoadedSources(true);
  });
  const view = () => run("preview", async () => {
    const normalized = normalizeConnectorSource(connection.provider, sourceId);
    setPreview(null); const result = await post<ConnectorPreview>("preview", { provider: connection.provider, sourceId: normalized });
    setSourceId(normalized); setPreview(result);
  });
  const importPage = () => run("import", async () => {
    const space = spaces.data?.items.find(s => s.id === spaceId);
    if (!space || !preview || preview.sourceId !== sourceId) return;
    const content = { type: "doc", content: [{ type: "personalWidget", attrs: { id: crypto.randomUUID(), kind: "connector", provider: connection.provider, title: preview.title, value: preview.sourceId } }, ...preview.text.split("\n").map(text => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) }))] };
    const page = await createPage({ title: preview.title, spaceId: space.id, content, format: "json" });
    navigate(buildPageUrl(space.slug, page.slugId, page.title));
  });
  const uploadJson = (file?: File) => run("credentials", async () => {
    if (!file) return;
    if (file.size > 32768) throw Error("Choose an OAuth client JSON file up to 32 KB.");
    const config = readGoogleClientJson(await file.text()); setClientId(config.clientId); setSecret(config.clientSecret);
    setFileHint(config.redirectUris.includes(connection.callbackUrl) ? "Credential file loaded. Save to continue." : "Credential file loaded. Register the callback URL shown here before logging in.");
  });
  const changeSource = (value: string) => { setSourceId(value); setPreview(null); };
  const Icon = icons[connection.provider];
  return <section hidden={!active} aria-label={info.name + " " + t("Connection settings")}>
    <Paper withBorder radius="md" className={classes.panel}>
      <div className={classes.panelHeader}><Icon size={28} stroke={1.5} aria-hidden /><div><Text fw={600}>{info.name}</Text><Text size="sm" c="dimmed">{t(info.description)}</Text></div><Badge color={connection.connected ? "green" : "gray"} variant="light">{t(connection.connected ? "Connected" : "Not connected")}</Badge></div>
      <nav className={classes.steps} aria-label={t("Connection steps")}>
        {["Register app", "Log in", "Import"].map((title, index) => <button key={title} type="button" aria-current={step === index + 1 ? "step" : undefined} disabled={!!busy || index === 1 && !connection.configured || index === 2 && !connection.connected} onClick={() => { setStep(index + 1); setError(""); setSuccess(""); }}><span>{index + 1}</span>{t(title)}</button>)}
      </nav>
      {error && <Alert mt="md" color="red" title={t("Connection failed")} role="alert">{error}<Text size="xs" mt="xs">{t("Check the callback URL and service permissions, then try again.")}</Text></Alert>}
      {success && <Alert mt="md" color="green" role="status">{t(success)}</Alert>}
      {step === 1 && <Stack gap="lg" className={classes.stepContent}>
        <div><Text fw={600}>{t("Create the service app once")}</Text><Text size="sm" c="dimmed" mt={4}>{t("The service issues your Client ID and Secret. Open its registration page below, then return here to finish. No .env edit or app restart is needed.")}</Text></div>
        <div className={classes.actions}><Button component="a" href={info.console} target="_blank" rel="noopener noreferrer" variant="default" rightSection={<IconExternalLink size={15} />}>{t("Open registration page")}</Button><Anchor href={info.docs} target="_blank" rel="noopener noreferrer" size="sm">{t("Official setup guide")}</Anchor></div>
        <ol className={classes.guide}>{info.steps.map(instruction => <li key={instruction}>{t(instruction)}</li>)}</ol>
        <CopyValue label="Homepage URL" value={new URL(connection.callbackUrl).origin} /><CopyValue label="Callback URL" value={connection.callbackUrl} />
        {connection.provider === "google-drive" && <div><input hidden ref={credentialsFile} type="file" accept="application/json,.json" aria-label={t("OAuth client JSON file")} onChange={event => { void uploadJson(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /><Button variant="light" leftSection={<IconUpload size={16} />} loading={busy === "credentials"} disabled={!!busy} onClick={() => credentialsFile.current?.click()}>{t("Load Google credential JSON")}</Button>{fileHint && <Text size="xs" mt="xs" c="dimmed" role="status">{t(fileHint)}</Text>}</div>}
        <div className={classes.credentials}>
          <TextInput label="Client ID" value={clientId} maxLength={500} disabled={!!busy} autoComplete="off" onChange={e => setClientId(e.currentTarget.value)} />
          <PasswordInput label="Client Secret" value={secret} disabled={!!busy} autoComplete="new-password" maxLength={2000} placeholder={connection.configured && !needsSecret ? t("Saved secret — leave blank to keep it") : undefined} onChange={e => setSecret(e.currentTarget.value)} visibilityToggleButtonProps={{ "aria-label": t("Toggle password visibility") }} />
        </div>
        {needsSecret && connection.configured && <Text size="sm" c="dimmed">{t("Enter the client secret for the new Client ID.")}</Text>}
        {connection.provider === "github" && <Checkbox label={t("Include private repositories (GitHub repo scope includes write access; Nopetion only reads)")} checked={privateRepos} disabled={!!busy} onChange={e => setPrivateRepos(e.currentTarget.checked)} />}
        <Text size="xs" c="dimmed">{t("Credentials are encrypted on this server. Saved secrets are never shown again.")}</Text>
        {connection.connected && dirty && <Text size="sm" c="dimmed">{t("Changing the app settings requires logging in again.")}</Text>}
        <div className={classes.actions}><Button disabled={!!busy || !canSave} loading={busy === "save"} variant="default" onClick={() => run("save", async () => { await save(); setStep(2); setSuccess("App settings saved"); })}>{t("Save and continue")}</Button><Button disabled={!!busy || !canSave} loading={busy === "connect"} onClick={connect}>{t("Save and log in")}</Button></div>
      </Stack>}
      {step === 2 && <Stack gap="lg" className={classes.stepContent}>
        <div className={classes.connectionIcon}><IconPlugConnected size={30} stroke={1.5} aria-hidden /></div>
        <Text fw={600}>{t("Log in to {{service}}", { service: info.name })}</Text>
        <Text size="sm" c="dimmed">{t("After approval, you return to this settings screen. Your Nopetion login stays the same.")}</Text>
        <Alert variant="light" color="gray">{t(info.permissions)}</Alert>
        <CopyValue label="Callback URL" value={connection.callbackUrl} />
        <div className={classes.actions}><Button loading={busy === "connect"} disabled={!!busy || dirty && !canSave} onClick={connect}>{t("Log in to {{service}}", { service: info.name })}</Button>{connection.connected && <Button variant="default" loading={busy === "verify"} disabled={!!busy || dirty} onClick={verify} leftSection={<IconCheck size={16} />}>{t("Verify connection")}</Button>}</div>
      </Stack>}
      {step === 3 && <Stack gap="lg" className={classes.stepContent}>
        <div className={classes.verifyRow}><div><Text fw={600}>{t("Choose what to import")}</Text><Text size="xs" c="dimmed" mt={4}>{verifiedAt ? t("Last verified: {{time}}", { time: new Date(verifiedAt).toLocaleString(i18n.language) }) : t("Verify access before choosing a source.")}</Text></div><Button variant="default" loading={busy === "verify"} disabled={!!busy || dirty} onClick={verify} leftSection={<IconCheck size={16} />}>{t("Verify connection")}</Button></div>
        <Text size="sm" c="dimmed">{t(info.sourceHint)}</Text>
        <div className={classes.actions}><Button variant="light" loading={busy === "sources"} disabled={!!busy || dirty} onClick={load} leftSection={<IconRefresh size={16} />}>{t(loadedSources ? "Refresh sources" : "Browse sources")}</Button><Text size="xs" c="dimmed">{t("Only the selected text is copied to a new Nopetion page.")}</Text></div>
        {loadedSources && choices.length === 0 && <Alert color="gray">{t("No supported sources found. Check sharing permissions or enter a source URL below.")}</Alert>}
        {choices.length > 0 && <Select label={t("Choose a source")} searchable clearable data={choices.map(c => ({ value: c.id, label: c.name }))} value={choices.some(c => c.id === sourceId) ? sourceId : null} disabled={!!busy || dirty} onChange={id => changeSource(id || "")} nothingFoundMessage={t("No results found")} />}
        <TextInput label={t("Source URL or ID")} description={connection.provider === "github" ? "owner/repository/path?ref=branch" : undefined} value={sourceId} disabled={!!busy || dirty} onChange={e => changeSource(e.currentTarget.value)} maxLength={1000} />
        <Button className={classes.previewButton} variant="default" loading={busy === "preview"} disabled={!!busy || dirty || !sourceId.trim()} onClick={view}>{t("Preview source")}</Button>
        {preview && <div className={classes.preview}><Text fw={600}>{preview.title || t("Untitled")}</Text><Textarea mt="sm" aria-label={t("Source preview")} readOnly value={preview.text} minRows={5} maxRows={12} autosize /><Text size="xs" c="dimmed" mt="xs">{t("{{count}} characters · Text preview", { count: preview.text.length })}</Text>
          <Select mt="md" label={t("Destination Space")} placeholder={t("Choose a Space")} data={(spaces.data?.items || []).map(s => ({ value: s.id, label: s.name }))} value={spaceId} disabled={!!busy || spaces.isLoading} onChange={id => setSpaceId(typeof id === "string" ? id : null)} />
          {spaces.isError && <Alert color="red" mt="xs">{t("Could not load Spaces")}<Button size="xs" variant="subtle" onClick={() => spaces.refetch()}>{t("Retry")}</Button></Alert>}
          <Button fullWidth mt="md" loading={busy === "import"} disabled={!!busy || !spaceId || !spaces.data?.items.some(s => s.id === spaceId) || preview.sourceId !== sourceId} onClick={importPage}>{t("Import as a new page")}</Button>
        </div>}
      </Stack>}
      <footer className={classes.footer}><Text size="xs" c="dimmed">{t(info.permissions)}</Text>{connection.connected && <Button size="xs" variant="subtle" color="red" disabled={!!busy} loading={busy === "disconnect"} onClick={() => run("disconnect", async () => { await post("disconnect", { provider: connection.provider }); setStep(2); setChoices([]); setLoadedSources(false); setPreview(null); setVerifiedAt(undefined); await refresh(); setSuccess("Disconnected. Your imported pages are kept."); })}>{t("Disconnect")}</Button>}</footer>
    </Paper>
  </section>;
}
