package co.korevia.eloquent;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.StatFs;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/** Métodos que la interfaz llama por JavaScript. Los resultados lentos vuelven como eventos. */
public class NativeBridge {
    private final MainActivity act;
    private final File recDir, stateFile;
    private final SpeechEngine speech;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingBackup = null;

    NativeBridge(MainActivity a) {
        act = a;
        recDir = new File(a.getFilesDir(), "rec");
        stateFile = new File(a.getFilesDir(), "state.json");
        speech = new SpeechEngine(a, recDir);
        tts = new TextToSpeech(a, status -> {
            if (status == TextToSpeech.SUCCESS) { ttsReady = true; pickVoice(); }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { finishUtterance(id, true); }
            @Override @SuppressWarnings("deprecation") public void onError(String id) { finishUtterance(id, false); }
        });
    }

    private void finishUtterance(String id, boolean ok) {
        if (id != null && id.startsWith("file:")) act.emit("synthDone", "{\"ok\":" + ok + "}");
        else act.emit("ttsDone", "{\"ok\":" + ok + "}");
    }

    private void pickVoice() {
        Locale[] prefer = { new Locale("es", "CO"), new Locale("es", "MX"), new Locale("es", "US"), new Locale("es", "419"), new Locale("es", "ES"), new Locale("es") };
        for (Locale l : prefer) {
            int r = tts.isLanguageAvailable(l);
            if (r >= TextToSpeech.LANG_AVAILABLE) { tts.setLanguage(l); return; }
        }
        ttsReady = false;
    }

    void shutdown() {
        speech.release();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        io.shutdown();
    }

    /* ---------- Estado ---------- */
    @JavascriptInterface public void saveState(String json) {
        io.execute(() -> {
            File tmp = new File(stateFile.getPath() + ".tmp");
            try (FileOutputStream o = new FileOutputStream(tmp)) {
                o.write(json.getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) { return; }
            tmp.renameTo(stateFile);
        });
    }
    @JavascriptInterface public String loadState() {
        try { return stateFile.exists() ? readAll(new FileInputStream(stateFile)) : ""; } catch (Exception e) { return ""; }
    }

    /* ---------- Micrófono y reconocimiento ---------- */
    @JavascriptInterface public boolean hasMicPermission() { return act.hasMic(); }
    @JavascriptInterface public void requestMicPermission() { act.runOnUiThread(act::askMic); }
    @JavascriptInterface public String startRecording(String id) {
        if (!act.hasMic()) return "Sin permiso de micrófono";
        return speech.start(id);
    }
    @JavascriptInterface public void stopRecording() { speech.stop(); }
    @JavascriptInterface public void keepAwake(boolean on) { act.setAwake(on); }
    @JavascriptInterface public String modelInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("name", "Vosk small-es 0.42");
            o.put("ready", speech.modelReady());
            o.put("sizeMb", speech.modelSizeMb());
            if (!speech.modelReady()) o.put("note", speech.modelNote());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }
    @JavascriptInterface public void deleteRec(String id) {
        if (!id.matches("[A-Za-z0-9_-]+")) return;
        new File(recDir, id + ".wav").delete();
    }

    /* ---------- Voz ---------- */
    @JavascriptInterface public void speak(String text, double rate) {
        if (!ttsReady) { act.emit("ttsDone", "{\"ok\":false}"); return; }
        tts.setSpeechRate((float) rate);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "say:" + UUID.randomUUID());
    }
    @JavascriptInterface public void stopSpeak() {
        if (tts != null) tts.stop();
    }
    @JavascriptInterface public void synthToFile(String id, String text, double rate) {
        if (!ttsReady || !id.matches("[A-Za-z0-9_-]+")) { act.emit("synthDone", "{\"ok\":false}"); return; }
        tts.setSpeechRate((float) rate);
        int r = tts.synthesizeToFile(text, null, new File(recDir, id + ".wav"), "file:" + id);
        if (r != TextToSpeech.SUCCESS) act.emit("synthDone", "{\"ok\":false}");
    }
    @JavascriptInterface public String ttsInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("ready", ttsReady);
            if (ttsReady) {
                Voice v = tts.getVoice();
                o.put("voice", v != null ? v.getName() : JSONObject.NULL);
                o.put("locale", v != null ? v.getLocale().toString() : JSONObject.NULL);
            }
            return o.toString();
        } catch (Exception e) { return "{\"ready\":false}"; }
    }

    /* ---------- Dispositivo ---------- */
    @JavascriptInterface public String deviceInfo() {
        try {
            JSONObject o = new JSONObject();
            o.put("platform", "Android");
            o.put("android", Build.VERSION.RELEASE);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "desconocida");
            ActivityManager am = (ActivityManager) act.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            o.put("ramMb", mi.totalMem / 1048576L);
            o.put("freeMb", mi.availMem / 1048576L);
            BatteryManager bm = (BatteryManager) act.getSystemService(Context.BATTERY_SERVICE);
            o.put("battery", bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY));
            if (Build.VERSION.SDK_INT >= 29) {
                PowerManager pm = (PowerManager) act.getSystemService(Context.POWER_SERVICE);
                o.put("thermal", thermalName(pm.getCurrentThermalStatus()));
            }
            double rtf = speech.lastRtf();
            if (rtf >= 0) o.put("lastRtf", Math.round(rtf * 100) / 100.0);
            return o.toString();
        } catch (Exception e) { return "{\"platform\":\"Android\"}"; }
    }
    private String thermalName(int s) {
        switch (s) {
            case PowerManager.THERMAL_STATUS_NONE: return "Normal";
            case PowerManager.THERMAL_STATUS_LIGHT: return "Ligera";
            case PowerManager.THERMAL_STATUS_MODERATE: return "Moderada";
            default: return "Alta";
        }
    }
    @JavascriptInterface public String storageInfo() {
        try {
            JSONObject o = new JSONObject();
            long used = 0;
            File[] l = recDir.listFiles();
            if (l != null) for (File f : l) used += f.length();
            o.put("bytes", used);
            StatFs fs = new StatFs(act.getFilesDir().getPath());
            o.put("free", fs.getAvailableBytes());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /* ---------- Recordatorio ---------- */
    @JavascriptInterface public void setReminder(boolean on, int h, int m) {
        ReminderReceiver.save(act, on, h, m);
        if (on) act.runOnUiThread(act::askNotifications);
    }

    /* ---------- Respaldo y exportación ---------- */
    @JavascriptInterface public void saveBackup(String json) {
        pendingBackup = json;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/zip");
        i.putExtra(Intent.EXTRA_TITLE, "eloquent-pro-respaldo.zip");
        launch(i, MainActivity.REQ_SAVE);
    }
    @SuppressWarnings("deprecation")
    private void launch(Intent i, int code) { act.runOnUiThread(() -> act.startActivityForResult(i, code)); }

    void onBackupTarget(Uri uri) {
        final String json = pendingBackup;
        pendingBackup = null;
        if (uri == null || json == null) { act.emit("backupSaved", "{\"ok\":false}"); return; }
        io.execute(() -> {
            try (OutputStream raw = act.getContentResolver().openOutputStream(uri); ZipOutputStream z = new ZipOutputStream(raw)) {
                z.putNextEntry(new ZipEntry("state.json"));
                z.write(json.getBytes(StandardCharsets.UTF_8));
                z.closeEntry();
                File[] l = recDir.listFiles();
                byte[] b = new byte[65536];
                if (l != null) for (File f : l) {
                    z.putNextEntry(new ZipEntry("rec/" + f.getName()));
                    try (FileInputStream in = new FileInputStream(f)) {
                        int n;
                        while ((n = in.read(b)) > 0) z.write(b, 0, n);
                    }
                    z.closeEntry();
                }
                act.emit("backupSaved", "{\"ok\":true}");
            } catch (Exception e) { act.emit("backupSaved", "{\"ok\":false}"); }
        });
    }
    @JavascriptInterface public void pickBackup() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        launch(i, MainActivity.REQ_OPEN);
    }
    void onBackupSource(Uri uri) {
        if (uri == null) { act.emit("backupLoaded", "{\"ok\":false}"); return; }
        io.execute(() -> {
            String json = null;
            try (InputStream raw = act.getContentResolver().openInputStream(uri); ZipInputStream z = new ZipInputStream(raw)) {
                ZipEntry e;
                byte[] b = new byte[65536];
                while ((e = z.getNextEntry()) != null) {
                    String n = e.getName();
                    if ("state.json".equals(n)) {
                        ByteArrayOutputStream o = new ByteArrayOutputStream();
                        int r;
                        while ((r = z.read(b)) > 0) o.write(b, 0, r);
                        json = o.toString("UTF-8");
                    } else if (n.startsWith("rec/") && n.substring(4).matches("[A-Za-z0-9_-]+\\.wav")) {
                        try (FileOutputStream o = new FileOutputStream(new File(recDir, n.substring(4)))) {
                            int r;
                            while ((r = z.read(b)) > 0) o.write(b, 0, r);
                        }
                    }
                }
                JSONObject out = new JSONObject();
                out.put("ok", json != null);
                if (json != null) out.put("json", json);
                act.emit("backupLoaded", out.toString());
            } catch (Exception ex) { act.emit("backupLoaded", "{\"ok\":false}"); }
        });
    }
    @JavascriptInterface public void shareRec(String id, String name) {
        if (!id.matches("[A-Za-z0-9_-]+")) return;
        io.execute(() -> {
            try {
                File dir = new File(act.getCacheDir(), "share");
                dir.mkdirs();
                String safe = name.replaceAll("[^\\p{L}0-9 _-]", "");
                File out = new File(dir, (safe.isEmpty() ? "grabacion" : safe) + ".wav");
                try (FileInputStream in = new FileInputStream(new File(recDir, id + ".wav")); FileOutputStream o = new FileOutputStream(out)) {
                    byte[] b = new byte[65536];
                    int n;
                    while ((n = in.read(b)) > 0) o.write(b, 0, n);
                }
                Uri uri = FileProvider.getUriForFile(act, "co.korevia.eloquent.files", out);
                Intent s = new Intent(Intent.ACTION_SEND);
                s.setType("audio/wav");
                s.putExtra(Intent.EXTRA_STREAM, uri);
                s.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                act.runOnUiThread(() -> act.startActivity(Intent.createChooser(s, "Exportar grabación")));
            } catch (Exception ignored) { }
        });
    }

    private String readAll(InputStream in) throws Exception {
        try (InputStream i = in) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] b = new byte[65536];
            int n;
            while ((n = i.read(b)) > 0) o.write(b, 0, n);
            return o.toString("UTF-8");
        }
    }
}
