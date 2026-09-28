package com.morefunos.smt.storekernel;

import android.content.Context;
import android.database.Cursor;

import androidx.annotation.NonNull;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import androidx.sqlite.db.SupportSQLiteDatabase;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

@Database(
    entities = {
        StoreKernelAggregateEntity.class,
        StoreKernelCommandReceiptEntity.class,
        StoreKernelInboxEntity.class,
        StoreKernelOutboxEntity.class,
        StoreKernelJournalEntity.class
    },
    version = 1,
    exportSchema = true
)
public abstract class StoreKernelDatabase extends RoomDatabase {
    public static final String DATABASE_NAME = "morefun_store_kernel.db";
    public static final int SCHEMA_VERSION = 1;

    private static volatile StoreKernelDatabase instance;
    private static final AtomicInteger WRITER_SEQUENCE = new AtomicInteger();

    private final ExecutorService serialWriter = Executors.newSingleThreadExecutor(new ThreadFactory() {
        @Override
        public Thread newThread(@NonNull Runnable runnable) {
            final Thread thread = new Thread(
                runnable,
                "morefun-store-kernel-writer-" + WRITER_SEQUENCE.incrementAndGet()
            );
            thread.setDaemon(true);
            return thread;
        }
    });

    abstract StoreKernelDao storeKernelDao();

    static StoreKernelDatabase open(@NonNull Context context) {
        StoreKernelDatabase current = instance;
        if (current != null) return current;
        synchronized (StoreKernelDatabase.class) {
            current = instance;
            if (current == null) {
                current = configure(
                    Room.databaseBuilder(context.getApplicationContext(), StoreKernelDatabase.class, DATABASE_NAME)
                ).build();
                instance = current;
            }
            return current;
        }
    }

    static RoomDatabase.Builder<StoreKernelDatabase> configure(
        RoomDatabase.Builder<StoreKernelDatabase> builder
    ) {
        return builder
            .setJournalMode(JournalMode.WRITE_AHEAD_LOGGING)
            .addCallback(new Callback() {
                @Override
                public void onOpen(@NonNull SupportSQLiteDatabase database) {
                    super.onOpen(database);
                    database.execSQL("PRAGMA synchronous=FULL");
                    database.execSQL("PRAGMA foreign_keys=ON");
                }
            });
    }

    ExecutorService serialWriter() {
        return serialWriter;
    }

    String journalModeReadback() {
        return readStringPragma("PRAGMA journal_mode").toLowerCase(Locale.ROOT);
    }

    int synchronousReadback() {
        return readIntegerPragma("PRAGMA synchronous");
    }

    int schemaVersionReadback() {
        return readIntegerPragma("PRAGMA user_version");
    }

    private String readStringPragma(String sql) {
        try (Cursor cursor = getOpenHelper().getWritableDatabase().query(sql)) {
            if (!cursor.moveToFirst()) throw new IllegalStateException("STORE_KERNEL_PRAGMA_READBACK_EMPTY");
            final String value = cursor.getString(0);
            if (value == null) throw new IllegalStateException("STORE_KERNEL_PRAGMA_READBACK_EMPTY");
            return value;
        }
    }

    private int readIntegerPragma(String sql) {
        try (Cursor cursor = getOpenHelper().getWritableDatabase().query(sql)) {
            if (!cursor.moveToFirst()) throw new IllegalStateException("STORE_KERNEL_PRAGMA_READBACK_EMPTY");
            return cursor.getInt(0);
        }
    }

    static void closeSingleton(StoreKernelDatabase database) {
        synchronized (StoreKernelDatabase.class) {
            if (instance == database) instance = null;
        }
        database.closeStoreKernel();
    }

    void closeStoreKernel() {
        serialWriter.shutdown();
        super.close();
    }
}
