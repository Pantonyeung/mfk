#!/usr/bin/env python3
"""Execute PrintGatewayStore's actual update predicate in SQLite, not Android.
This supplements, and does not replace, the Robolectric gateway suite.
"""
import json
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / 'carrier/android/app/src/main/java/com/morefunos/smt/print/gateway/PrintGatewayStore.java'


def actual_update_predicate():
    source = STORE.read_text()
    update = source[source.index('final int updated = getWritableDatabase().update('):]
    match = re.search(r'values,\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+),\s*new String\[\]\{([^}]+)\}', update)
    if not match:
        raise AssertionError('Cannot read the real native update predicate and binding order')
    predicate = ''.join(json.loads(token) for token in re.findall(r'"(?:[^"\\]|\\.)*"', match.group(1)))
    bindings = [token.strip() for token in match.group(2).split(',')]
    return predicate, bindings


class NativePrintTransitionSqlTest(unittest.TestCase):
    def apply(self, previous, incoming, attempt='A1'):
        predicate, names = actual_update_predicate()
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE print_gateway_job (dispatch_attempt_id TEXT PRIMARY KEY, state TEXT NOT NULL)')
            db.execute('INSERT INTO print_gateway_job VALUES (?,?)', ('A1', previous))
            values = {'dispatchAttemptId': attempt, 'state': incoming}
            args = [values[name] for name in names]
            count = db.execute('UPDATE print_gateway_job SET state=? WHERE ' + predicate, [incoming, *args]).rowcount
            state = db.execute('SELECT state FROM print_gateway_job WHERE dispatch_attempt_id=?', ('A1',)).fetchone()[0]
            return state, count

    def test_ambiguity_cannot_become_safe_to_retry(self):
        self.assertEqual(self.apply('AMBIGUOUS_AFTER_SEND', 'FAILED_BEFORE_SEND'), ('AMBIGUOUS_AFTER_SEND', 0))

    def test_acknowledged_cannot_become_not_printed(self):
        self.assertEqual(self.apply('ACKNOWLEDGED', 'FAILED_BEFORE_SEND'), ('ACKNOWLEDGED', 0))

    def test_acknowledged_cannot_regress_to_unknown_or_dispatch(self):
        for incoming in ['AMBIGUOUS_AFTER_SEND', 'DISPATCHING', 'PERSISTED']:
            with self.subTest(incoming=incoming):
                self.assertEqual(self.apply('ACKNOWLEDGED', incoming), ('ACKNOWLEDGED', 0))

    def test_correlated_later_ack_can_resolve_ambiguity(self):
        self.assertEqual(self.apply('AMBIGUOUS_AFTER_SEND', 'ACKNOWLEDGED'), ('ACKNOWLEDGED', 1))

    def test_same_terminal_evidence_is_idempotent(self):
        for state in ['ACKNOWLEDGED', 'AMBIGUOUS_AFTER_SEND']:
            with self.subTest(state=state):
                self.assertEqual(self.apply(state, state), (state, 1))

    def test_foreign_attempt_cannot_modify_another_job(self):
        self.assertEqual(self.apply('AMBIGUOUS_AFTER_SEND', 'ACKNOWLEDGED', 'FOREIGN'), ('AMBIGUOUS_AFTER_SEND', 0))

    def test_first_pre_send_failure_remains_representable(self):
        self.assertEqual(self.apply('DISPATCHING', 'FAILED_BEFORE_SEND'), ('FAILED_BEFORE_SEND', 1))


if __name__ == '__main__':
    unittest.main()
