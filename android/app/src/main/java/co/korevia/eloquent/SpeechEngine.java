package co.korevia.eloquent;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;

/** Graba PCM de 16 kHz a WAV y lo reconoce con Vosk en el mismo hilo, sin internet. */
class SpeechEngine {
    private static final int RATE = 16000;
    private static final String ASSET_MODEL = "model-es";
    private final MainActivity act;
    private final File recDir, modelDir;
    private volatile Model model;
    private volatile String modelError = null;
    private volatile boolean running = false;
    private volatile double lastRtf = -1;
    private Thread worker;
    private long modelBytes = 0;

    SpeechEngine(MainActivity a, File dir) {
        act = a;
        recDir = dir;
        modelDir = new File(a.getFilesDir(), ASSET_MODEL);
        new Thread(this::prepareModel, "ep-model").start();
    }

    /* Copia el modelo a archivos internos una sola vez y lo carga. */
    private void prepareModel() {
        try {
            File mark = new File(modelDir, ".listo");
            if (!mark.exists()) {
                deleteTree(modelDir);
                copyAssets(ASSET_MODEL, modelDir);
                new FileOutputStream(mark).close();
            }
            modelBytes = sizeOf(modelDir);
            model = new Model(modelDir.getAbsolutePath());
        } catch (Throwable t) {
            modelError = "No se pudo cargar el modelo: " + t.getMessage();
        }
    }
    private void copyAssets(String path, File to) throws Exception {
        String[] list = act.getAssets().list(path);
        if (list == null || list.length == 0) {
            to.getParentFile().mkdirs();
            try (InputStream in = act.getAssets().open(path); OutputStream o = new FileOutputStream(to)) {
                byte[] b = new byte[65536];
                int n;
                while ((n = in.read(b)) > 0) o.write(b, 0, n);
            }
            return;
        }
        to.mkdirs();
        for (String n : list) copyAssets(path + "/" + n, new File(to, n));
    }
    private void deleteTree(File f) {
        File[] l = f.listFiles();
        if (l != null) for (File c : l) deleteTree(c);
        f.delete();
    }
    private long sizeOf(File f) {
        if (f.isFile()) return f.length();
        long s = 0;
        File[] l = f.listFiles();
        if (l != null) for (File c : l) s += sizeOf(c);
        return s;
    }

    boolean modelReady() { return model != null; }
    long modelSizeMb() { return modelBytes / 1048576L; }
    String modelNote() { return modelError != null ? modelError : "Preparando el modelo, la primera vez tarda unos segundos."; }
    double lastRtf() { return lastRtf; }

    @SuppressLint("MissingPermission")
    String start(final String id) {
        if (running) return "Ya hay una grabación en curso";
        if (!id.matches("[A-Za-z0-9_-]+")) return "Identificador inválido";
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (min <= 0) return "El micrófono no admite 16 kHz";
        final AudioRecord rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min * 2, 8192));
        if (rec.getState() != AudioRecord.STATE_INITIALIZED) { rec.release(); return "No se pudo abrir el micrófono"; }
        running = true;
        rec.startRecording();
        worker = new Thread(() -> loop(id, rec), "ep-rec");
        worker.start();
        return "ok";
    }

    void stop() { running = false; }

    private void loop(String id, AudioRecord rec) {
        File wav = new File(recDir, id + ".wav");
        Recognizer rg = null;
        JSONArray allWords = new JSONArray();
        StringBuilder text = new StringBuilder();
        long dataBytes = 0, nanos = 0;
        String engine = "Vosk small-es 0.42";
        try (FileOutputStream raw = new FileOutputStream(wav)) {
            raw.write(new byte[44]);
            if (model != null) { rg = new Recognizer(model, RATE); rg.setWords(true); }
            else engine = "Sin transcripción: modelo no listo";
            byte[] buf = new byte[4096];
            long lastPartial = 0;
            while (running) {
                int n = rec.read(buf, 0, buf.length);
                if (n <= 0) continue;
                raw.write(buf, 0, n);
                dataBytes += n;
                if (rg != null) {
                    long t0 = System.nanoTime();
                    boolean fin = rg.acceptWaveForm(buf, n);
                    if (fin) collect(rg.getResult(), allWords, text);
                    else {
                        long now = System.currentTimeMillis();
                        if (now - lastPartial > 300) {
                            lastPartial = now;
                            String p = new JSONObject(rg.getPartialResult()).optString("partial", "");
                            JSONObject e = new JSONObject();
                            e.put("text", (text + " " + p).trim());
                            act.emit("partial", e.toString());
                        }
                    }
                    nanos += System.nanoTime() - t0;
                }
            }
            if (rg != null) { collect(rg.getFinalResult(), allWords, text); rg.close(); rg = null; }
        } catch (Exception e) {
            engine = "Error: " + e.getMessage();
        } finally {
            try { rec.stop(); } catch (Exception ignored) { }
            rec.release();
            if (rg != null) rg.close();
        }
        double dur = dataBytes / (2.0 * RATE);
        if (dur > 0 && nanos > 0) lastRtf = (nanos / 1e9) / dur;
        try {
            writeHeader(wav, dataBytes);
            JSONObject d = new JSONObject();
            d.put("id", id);
            d.put("text", text.toString().trim());
            d.put("words", allWords);
            d.put("durationSec", dur);
            d.put("engine", engine);
            act.emit("recDone", d.toString());
        } catch (Exception e) {
            act.emit("recDone", "{\"id\":\"" + id + "\",\"text\":\"\",\"durationSec\":0,\"engine\":\"Error al guardar\"}");
        }
    }

    private void collect(String json, JSONArray words, StringBuilder text) throws Exception {
        JSONObject o = new JSONObject(json);
        String t = o.optString("text", "");
        if (!t.isEmpty()) { if (text.length() > 0) text.append(' '); text.append(t); }
        JSONArray r = o.optJSONArray("result");
        if (r != null) for (int i = 0; i < r.length(); i++) words.put(r.get(i));
    }

    private void writeHeader(File f, long data) throws Exception {
        try (RandomAccessFile w = new RandomAccessFile(f, "rw")) {
            w.seek(0);
            w.writeBytes("RIFF"); le32(w, 36 + data); w.writeBytes("WAVEfmt "); le32(w, 16);
            le16(w, 1); le16(w, 1); le32(w, RATE); le32(w, RATE * 2); le16(w, 2); le16(w, 16);
            w.writeBytes("data"); le32(w, data);
        }
    }
    private void le32(RandomAccessFile w, long v) throws Exception { for (int i = 0; i < 4; i++) w.write((int) ((v >> (8 * i)) & 255)); }
    private void le16(RandomAccessFile w, int v) throws Exception { w.write(v & 255); w.write((v >> 8) & 255); }

    void release() {
        running = false;
        try { if (worker != null) worker.join(1500); } catch (InterruptedException ignored) { }
        if (model != null) { model.close(); model = null; }
    }
}
