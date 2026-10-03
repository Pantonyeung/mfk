package com.morefunos.smt.runtime;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

@RunWith(RobolectricTestRunner.class)
@Config(manifest = Config.NONE, sdk = 30)
public final class RuntimeAtomicFileRecoveryTest {
    private Context context;
    private File runtimeRoot;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        runtimeRoot = new File(context.getFilesDir(), "runtime");
        RuntimeBundleVerifier.deleteRecursively(runtimeRoot);
        assertTrue(runtimeRoot.mkdirs());
    }

    @After
    public void tearDown() {
        RuntimeBundleVerifier.deleteRecursively(runtimeRoot);
    }

    @Test
    public void prepareBoot_recoversBackupOnlyActivationStateBeforePruning() throws Exception {
        final String releaseId = "release-current";
        final File releaseDirectory = new File(runtimeRoot, "releases/" + releaseId);
        assertTrue(releaseDirectory.mkdirs());
        write(new File(releaseDirectory, "index.html"), "<html></html>");

        final RuntimeActivationState state = new RuntimeActivationState(
            releaseId,
            null,
            null,
            null,
            false
        );
        final File base = new File(runtimeRoot, "activation.json");
        final File backup = new File(runtimeRoot, "activation.json.bak");
        write(backup, state.toJson().toString());
        assertFalse(base.exists());
        assertTrue(backup.isFile());

        final RuntimeReleaseStore.BootSelection selection = new RuntimeReleaseStore(context).prepareBoot();

        assertEquals(releaseId, selection.releaseId);
        assertNotNull(selection.directory);
        assertTrue(new File(selection.directory, "index.html").isFile());
        assertTrue(base.isFile());
        assertFalse(backup.exists());
    }

    @Test
    public void selectedReleaseId_recoversBackupOnlySelection() throws Exception {
        final File base = new File(runtimeRoot, "ota-selection.json");
        final File backup = new File(runtimeRoot, "ota-selection.json.bak");
        write(backup, "{\"releaseId\":\"release-selected\"}");
        assertFalse(base.exists());
        assertTrue(backup.isFile());

        assertEquals("release-selected", new RuntimeUpdateSelectionStore(context).selectedReleaseId());
        assertTrue(base.isFile());
        assertFalse(backup.exists());
    }

    private static void write(File file, String value) throws Exception {
        final File parent = file.getParentFile();
        if (parent != null && !parent.exists()) assertTrue(parent.mkdirs());
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(value.getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
    }
}
