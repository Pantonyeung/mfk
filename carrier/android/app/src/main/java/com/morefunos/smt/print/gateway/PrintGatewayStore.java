package com.morefunos.smt.print.gateway;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class PrintGatewayStore extends SQLiteOpenHelper {
    private static final String DB_NAME = "morefun_print_gateway.db";
    private static final int DB_VERSION = 1;

    public PrintGatewayStore(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE print_gateway_job (" +
            "local_job_id TEXT PRIMARY KEY," +
            "canonical_print_job_id TEXT NOT NULL," +
            "dispatch_attempt_id TEXT NOT NULL UNIQUE," +
            "target_json TEXT NOT NULL," +
            "payload_base64 TEXT NOT NULL," +
            "payload_digest TEXT NOT NULL," +
            "state TEXT NOT NULL," +
            "last_stage TEXT NOT NULL," +
            "last_code TEXT," +
            "created_at TEXT NOT NULL," +
            "updated_at TEXT NOT NULL" +
            ")"
        );
        db.execSQL("CREATE INDEX idx_print_gateway_state ON print_gateway_job(state, updated_at)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("PRINT_GATEWAY_SCHEMA_UPGRADE_REQUIRED");
    }

    public synchronized void insert(
        String localJobId,
        String canonicalPrintJobId,
        String dispatchAttemptId,
        JSONObject target,
        String payloadBase64,
        String payloadDigest,
        String now
    ) {
        final ContentValues values = new ContentValues();
        values.put("local_job_id", localJobId);
        values.put("canonical_print_job_id", canonicalPrintJobId);
        values.put("dispatch_attempt_id", dispatchAttemptId);
        values.put("target_json", target.toString());
        values.put("payload_base64", payloadBase64);
        values.put("payload_digest", payloadDigest);
        values.put("state", "PERSISTED");
        values.put("last_stage", "PERSISTED");
        values.putNull("last_code");
        values.put("created_at", now);
        values.put("updated_at", now);
        if (getWritableDatabase().insertOrThrow("print_gateway_job", null, values) < 0) {
            throw new IllegalStateException("PRINT_GATEWAY_QUEUE_PERSIST_FAILED");
        }
    }

    public synchronized void update(String dispatchAttemptId, String state, String stage, String code, String now, boolean clearPayload) {
        final ContentValues values = new ContentValues();
        values.put("state", state);
        values.put("last_stage", stage);
        if (code == null || code.trim().isEmpty()) values.putNull("last_code"); else values.put("last_code", code);
        values.put("updated_at", now);
        if (clearPayload) values.put("payload_base64", "");
        final int updated = getWritableDatabase().update(
            "print_gateway_job",
            values,
            "dispatch_attempt_id=?",
            new String[]{dispatchAttemptId}
        );
        if (updated != 1) throw new IllegalStateException("PRINT_GATEWAY_JOB_NOT_FOUND");
    }

    public synchronized JSONArray recoverableJobs() throws JSONException {
        final JSONArray result = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT local_job_id,canonical_print_job_id,dispatch_attempt_id,target_json,payload_base64,payload_digest,state,last_stage,created_at,updated_at " +
            "FROM print_gateway_job WHERE state IN ('PERSISTED','DISPATCHING') ORDER BY created_at ASC",
            null
        )) {
            while (cursor.moveToNext()) {
                final JSONObject job = new JSONObject();
                job.put("localJobId", cursor.getString(0));
                job.put("canonicalPrintJobId", cursor.getString(1));
                job.put("dispatchAttemptId", cursor.getString(2));
                job.put("target", new JSONObject(cursor.getString(3)));
                job.put("payloadBase64", cursor.getString(4));
                job.put("payloadDigest", cursor.getString(5));
                job.put("state", cursor.getString(6));
                job.put("lastStage", cursor.getString(7));
                job.put("createdAt", cursor.getString(8));
                job.put("updatedAt", cursor.getString(9));
                result.put(job);
            }
        }
        return result;
    }

    public synchronized JSONObject latestSnapshot() throws JSONException {
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT local_job_id,canonical_print_job_id,dispatch_attempt_id,state,last_stage,last_code,created_at,updated_at " +
            "FROM print_gateway_job ORDER BY updated_at DESC LIMIT 1",
            null
        )) {
            final JSONObject result = new JSONObject();
            result.put("queueDepth", queueDepth());
            if (!cursor.moveToFirst()) {
                result.put("lastJob", JSONObject.NULL);
                return result;
            }
            final JSONObject job = new JSONObject();
            job.put("localJobId", cursor.getString(0));
            job.put("canonicalPrintJobId", cursor.getString(1));
            job.put("dispatchAttemptId", cursor.getString(2));
            job.put("state", cursor.getString(3));
            job.put("lastStage", cursor.getString(4));
            if (cursor.isNull(5)) job.put("lastCode", JSONObject.NULL); else job.put("lastCode", cursor.getString(5));
            job.put("createdAt", cursor.getString(6));
            job.put("updatedAt", cursor.getString(7));
            result.put("lastJob", job);
            return result;
        }
    }

    public synchronized int queueDepth() {
        try (Cursor cursor = getReadableDatabase().rawQuery(
            "SELECT COUNT(*) FROM print_gateway_job WHERE state IN ('PERSISTED','DISPATCHING')",
            null
        )) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }
}
