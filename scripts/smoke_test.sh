#!/usr/bin/env bash
# Quick end-to-end smoke test against a running backend (default localhost:8000).
# Exercises the flows in the SRS §20.2 live demo script.
set -euo pipefail
BASE="${1:-http://localhost:8000}"

pass() { echo "  OK  $1"; }
fail() { echo "FAIL  $1"; exit 1; }

check_200() {
  local desc="$1"; shift
  code=$(curl -s -o /tmp/smoke_body.json -w "%{http_code}" "$@")
  [ "$code" = "200" ] && pass "$desc" || { fail "$desc (HTTP $code)"; }
}

echo "== SIF Sentinel AI smoke test against $BASE =="

check_200 "health" "$BASE/api/v1/health"
check_200 "kpis" "$BASE/api/v1/analytics/kpis"
check_200 "sites" "$BASE/api/v1/analytics/sites"
check_200 "areas" "$BASE/api/v1/analytics/areas"
check_200 "lsr" "$BASE/api/v1/analytics/lsr"
check_200 "heatmap" "$BASE/api/v1/analytics/heatmap"
check_200 "forecast" "$BASE/api/v1/forecast"
check_200 "graph" "$BASE/api/v1/graph?limit=20"
check_200 "incidents list" "$BASE/api/v1/incidents?page=1&page_size=5"

check_200 "submit live report" -X POST "$BASE/api/v1/incidents" \
  -H 'Content-Type: application/json' \
  -d '{"narrative":"Worker contacted an energized 415V cable while replacing a junction box; lockout not verified before work start."}'
RISK_BAND=$(python3 -c "import json;print(json.load(open('/tmp/smoke_body.json'))['risk_band'])")
[ "$RISK_BAND" = "CRITICAL" ] && pass "live report scored CRITICAL as expected" || fail "expected CRITICAL, got $RISK_BAND"
RID=$(python3 -c "import json;print(json.load(open('/tmp/smoke_body.json'))['report_id'])")

check_200 "fetch submitted report" "$BASE/api/v1/incidents/$RID"
check_200 "similar fatalities for submitted report" "$BASE/api/v1/incidents/$RID/similar?type=FATALITY"
check_200 "recommendations for submitted report" -X POST "$BASE/api/v1/recommendations/$RID"

check_200 "copilot site ranking" -X POST "$BASE/api/v1/copilot/query" \
  -H 'Content-Type: application/json' -d '{"query":"Which site is most dangerous?"}'
GROUNDED=$(python3 -c "import json;print(json.load(open('/tmp/smoke_body.json'))['grounded'])")
[ "$GROUNDED" = "True" ] && pass "copilot answer grounded with citations" || fail "copilot answer not grounded"

check_200 "copilot report lookup" -X POST "$BASE/api/v1/copilot/query" \
  -H 'Content-Type: application/json' -d "{\"query\":\"Why is report $RID rated critical?\"}"

code=$(curl -s -o /tmp/smoke_bulletin.pdf -w "%{http_code}" -X POST "$BASE/api/v1/bulletin" \
  -H 'Content-Type: application/json' -d '{"scope":"daily"}')
[ "$code" = "200" ] && file /tmp/smoke_bulletin.pdf | grep -q PDF && pass "bulletin PDF generated" || fail "bulletin generation"

check_200 "semantic search" -X POST "$BASE/api/v1/search/semantic" \
  -H 'Content-Type: application/json' -d '{"query":"confined space entry without gas testing","top_k":5}'

# ---- Safety Memory ---------------------------------------------------------
check_200 "safety memory: ad-hoc recall" -X POST "$BASE/api/v1/memory/recall" \
  -H 'Content-Type: application/json' \
  -d '{"narrative":"Worker touched energized cable while replacing a junction box. Lockout was not verified."}'
python3 - <<'PY' && pass "recall returns matches, cause and action" || fail "recall payload incomplete"
import json, sys
d = json.load(open('/tmp/smoke_body.json'))
assert d['matches'], "no matches"
assert d['verdict'] in {"REPEAT_FATAL_PATTERN","REPEAT_PATTERN","RELATED_FATAL_PRECEDENT","WEAK_PRECEDENT"}, d['verdict']
assert d['common_cause'] and d['common_cause']['support'] <= d['common_cause']['of'], "bad common_cause"
assert d['recommended_action']['corrective'], "no corrective action"
assert all(m['report_id'] for m in d['matches']), "match missing id"
PY

check_200 "safety memory: recall for existing report" "$BASE/api/v1/incidents/$RID/memory"
check_200 "safety memory: recurring patterns" "$BASE/api/v1/memory/patterns?limit=5"
python3 - <<'PY' && pass "patterns ranked with fatal/site spread" || fail "patterns payload incomplete"
import json
d = json.load(open('/tmp/smoke_body.json'))
assert d['available'] and d['patterns'], "no patterns"
p = d['patterns'][0]
for k in ("pattern_id","label","size","fatal_count","site_spread","dominant_rule","severity_score"):
    assert k in p, f"missing {k}"
PY

check_200 "safety memory: single pattern" "$BASE/api/v1/memory/patterns/0"

# submission auto-attaches memory -- the "every new report is compared" claim
python3 - <<'PY' && pass "new submission auto-attaches safety_memory" || fail "submission missing safety_memory"
import json, urllib.request
req = urllib.request.Request(
    "http://localhost:8000/api/v1/incidents",
    data=json.dumps({"narrative": "Worker was struck by a falling scaffold plank while working at height with no edge protection."}).encode(),
    headers={"Content-Type": "application/json"})
d = json.load(urllib.request.urlopen(req))
assert "safety_memory" in d, "no safety_memory key"
assert d["safety_memory"].get("verdict"), "memory not computed"
PY

# ---- Structured natural-language query -------------------------------------
check_200 "structured query: 4-constraint parse" -X POST "$BASE/api/v1/copilot/structured-query" \
  -H 'Content-Type: application/json' \
  -d '{"query":"Show all confined space incidents during monsoon having SIF > 90 where gas detector failed."}'
python3 - <<'PY' && pass "parses hazard+season+threshold+control, nothing unrecognised" || fail "structured parse incomplete"
import json
d = json.load(open('/tmp/smoke_body.json'))
p = d['parsed']
assert p['topic']['rule'] == 'CONFINED_SPACE', p['topic']
assert p['season']['name'] == 'monsoon', p['season']
assert p['sif'] == {'op': '>', 'value': 0.9, 'human': 'SIF > 90%'}, p['sif']
assert 'gas detector' in p['conditions'], p['conditions']
assert not p['unrecognised'], p['unrecognised']
assert len(d['applied_filters']) == 4, d['applied_filters']
PY

check_200 "structured query: returns aggregate" -X POST "$BASE/api/v1/copilot/structured-query" \
  -H 'Content-Type: application/json' \
  -d '{"query":"Show all work at height incidents during monsoon having SIF > 90"}'
python3 - <<'PY' && pass "aggregate has count, top site and repeated barrier" || fail "aggregate incomplete"
import json
d = json.load(open('/tmp/smoke_body.json'))
a = d['aggregate']
assert a and a['count'] > 0, "no results"
assert a['most_common_site']['site'], "no top site"
assert a['repeated_barrier']['label'], "no repeated barrier"
assert d['citations'], "not grounded"
PY

# a zero-result query must diagnose the binding constraint, not just shrug
python3 - <<'PY' && pass "zero-result query names the binding constraint" || fail "no relaxation diagnosis"
import json, urllib.request
req = urllib.request.Request(
    "http://localhost:8000/api/v1/copilot/structured-query",
    data=json.dumps({"query": "confined space incidents during monsoon having SIF > 90 where gas detector failed"}).encode(),
    headers={"Content-Type": "application/json"})
d = json.load(urllib.request.urlopen(req))
assert d['aggregate'] is None, "expected zero results"
assert d['relaxation'] and d['relaxation'][0]['would_match'] > 0, "no usable relaxation"
assert 'binding constraint' in d['answer'], d['answer']
PY

check_200 "copilot chat routes structured intent" -X POST "$BASE/api/v1/copilot/query" \
  -H 'Content-Type: application/json' -d '{"query":"Show all work at height incidents during monsoon having SIF > 90"}'
INTENT=$(python3 -c "import json;print(json.load(open('/tmp/smoke_body.json'))['intent'])")
[ "$INTENT" = "structured_query" ] && pass "chat -> structured_query intent" || fail "expected structured_query, got $INTENT"

check_200 "copilot chat routes safety memory intent" -X POST "$BASE/api/v1/copilot/query" \
  -H 'Content-Type: application/json' -d '{"query":"Has this happened before? Worker touched an energized cable while replacing a junction box."}'
INTENT=$(python3 -c "import json;print(json.load(open('/tmp/smoke_body.json'))['intent'])")
[ "$INTENT" = "safety_memory" ] && pass "chat -> safety_memory intent" || fail "expected safety_memory, got $INTENT"

echo "== All smoke tests passed =="
