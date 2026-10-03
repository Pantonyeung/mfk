#!/usr/bin/env python3
"""Run the real pure native resolver, not Room/Android, with a constants-only Admin stub."""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PACKAGE = pathlib.Path("com/morefunos/smt/storekernel/business")
MAIN = ROOT / "carrier/android/app/src/main/java" / PACKAGE
TEST = ROOT / "carrier/android/app/src/test/java" / PACKAGE

with tempfile.TemporaryDirectory(prefix="mfp-native-quote-") as raw:
    temp = pathlib.Path(raw)
    stub = temp / "src" / PACKAGE / "FormalAdminConfigProducer.java"
    stub.parent.mkdir(parents=True)
    source = (MAIN / "FormalAdminConfigProducer.java").read_text()
    for declaration in [
        'public static final String AGGREGATE_TYPE = "ADMIN_ACTIVE_CONFIGURATION";',
        'public static final String SCHEMA = "MFK_ADMIN_CONFIG_SYNC_V1";',
    ]:
        assert declaration in source, "Production constants drifted; update explicit test stub"
    stub.write_text('''package com.morefunos.smt.storekernel.business;
// Constants only. This does not execute or substitute the Admin producer.
public final class FormalAdminConfigProducer {
 public static final String AGGREGATE_TYPE = "ADMIN_ACTIVE_CONFIGURATION";
 public static final String SCHEMA = "MFK_ADMIN_CONFIG_SYNC_V1";
}
''')
    classes = temp / "classes"
    classes.mkdir()
    subprocess.run([
        "java", "com.sun.tools.javac.Main", "-source", "17", "-target", "17", "-Xlint:all,-options", "-d", str(classes),
        str(stub), str(MAIN / "FormalCheckoutSourceContracts.java"),
        str(MAIN / "FormalQuoteSelectionResolver.java"), str(TEST / "FormalQuoteSelectionResolverTest.java"),
    ], check=True)
    subprocess.run(["java", "-cp", str(classes),
                    "com.morefunos.smt.storekernel.business.FormalQuoteSelectionResolverTest"], check=True)
print("Java 17 source/bytecode on installed JDK; API compatibility not checked (ct.sym absent). Constants stub only; no native producer, Room, Android, or live-data proof.")
