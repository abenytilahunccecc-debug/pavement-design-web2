"""Generate parity fixtures for the TypeScript AASHTO engine from the tested Python engine.

The TypeScript port (backend/src/engine) must reproduce these results exactly
(tolerance 1e-9), so the web app and the original Python/notebook calculator
can never silently disagree.

Usage (from this folder):
    python tools/generate_engine_fixtures.py ../python backend/src/engine/__fixtures__/python-cases.json
"""
import json
import random
import sys
from pathlib import Path

python_project = Path(sys.argv[1]).resolve()
out_file = Path(sys.argv[2])
sys.path.insert(0, str(python_project))
from pavement_design import DesignInput, design_pavement  # noqa: E402

LAYERS = ("ac", "dbm", "base", "subbase", "capping")


def to_camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(p.capitalize() for p in rest)


def camel_keys(value):
    """snake_case result keys -> camelCase (layer keys such as 'subgrade' stay as they are)."""
    if isinstance(value, dict):
        return {(to_camel(k) if "_" in k else k): camel_keys(v) for k, v in value.items()}
    if isinstance(value, list):
        return [camel_keys(v) for v in value]
    return value


def ts_input(kw: dict) -> dict:
    """The same design input in the web API's camelCase shape."""
    mapping = {"use_dbm_layer": "useDbmLayer", "use_capping_layer": "useCappingLayer", "mr_method": "mrMethod",
               "mr_psi": "mrPsi", "thickness_mm": "thicknessMm", "round_up_to_mm": "roundUpToMm",
               "enforce_aashto_minimums": "enforceAashtoMinimums"}
    return {mapping.get(k, k): v for k, v in kw.items()}


NAMED = {
    "defaults": {},
    "user spreadsheet (R98, W18 131, base MR 43,500)": dict(
        reliability=98, w18=131, mr_method="mr",
        mr_psi={"subgrade": 7500, "capping": 15000, "subbase": 15000, "base": 43500, "dbm": 400000}),
    "no DBM (3 layers)": dict(use_dbm_layer=False),
    "capping (5 layers)": dict(use_capping_layer=True),
    "no DBM + capping": dict(use_dbm_layer=False, use_capping_layer=True),
    "MR entered directly": dict(mr_method="mr"),
    "custom thickness, AC too thin": dict(thickness_mm={"ac": 60, "base": 250}),
    "round up 5 mm": dict(round_up_to_mm=5),
    "AASHTO minimums, low traffic": dict(enforce_aashto_minimums=True, w18=0.1),
    "reliability 88 (not in table)": dict(reliability=88),
    "reliability 97.5 (not in table)": dict(reliability=97.5, use_capping_layer=True),
    "zero DBM coefficient": dict(a={"ac": 0.44, "dbm": 0.0, "base": 0.14, "subbase": 0.11, "capping": 0.08}),
    "tiny traffic, stiff support": dict(w18=0.001, mr_method="mr",
                                        mr_psi={"subgrade": 30000, "capping": 40000, "subbase": 45000,
                                                "base": 60000, "dbm": 400000}),
}


def random_case(rng: random.Random) -> dict:
    return dict(
        reliability=rng.choice([75, 85, 88, 90, 95, 97.5, 98, 99]),
        so=round(rng.uniform(0.35, 0.5), 2), w18=round(rng.uniform(0.5, 150), 1), dpsi=round(rng.uniform(1.5, 2.7), 1),
        use_dbm_layer=rng.random() < 0.6, use_capping_layer=rng.random() < 0.4,
        mr_method=rng.choice(["cbr", "cbr", "mr"]),
        cbr={k: round(rng.uniform(lo, hi), 1) for k, lo, hi in
             [("subgrade", 2, 20), ("capping", 8, 25), ("subbase", 15, 50), ("base", 40, 100)]},
        mr_psi={"subgrade": round(rng.uniform(3000, 20000)), "capping": round(rng.uniform(10000, 25000)),
                "subbase": round(rng.uniform(12000, 30000)), "base": round(rng.uniform(25000, 50000)),
                "dbm": round(rng.uniform(250000, 500000), -3)},
        a={"ac": round(rng.uniform(0.3, 0.44), 2), "dbm": round(rng.uniform(0.2, 0.4), 2),
           "base": round(rng.uniform(0.1, 0.16), 2), "subbase": round(rng.uniform(0.08, 0.13), 2),
           "capping": round(rng.uniform(0.05, 0.1), 2)},
        # AC and DBM are asphalt: m = 1 (the web app has no m2). Draw dbm anyway so the random sequence is unchanged.
        m={k: (1.0 if k == "dbm" else v) for k, v in
           {k: round(rng.uniform(0.6, 1.3), 2) for k in ("dbm", "base", "subbase", "capping")}.items()},
        thickness_mm=({"ac": round(rng.uniform(50, 250))} if rng.random() < 0.3 else {}),
        round_up_to_mm=rng.choice([None, None, 5, 10]),
        enforce_aashto_minimums=rng.random() < 0.3,
    )


cases = [(name, kw) for name, kw in NAMED.items()]
rng = random.Random(1993)
cases += [(f"random {i + 1}", random_case(rng)) for i in range(50)]

fixtures = []
for name, kw in cases:
    result = design_pavement(DesignInput(**kw)).to_dict()
    fixtures.append({"name": name, "input": ts_input(kw), "result": camel_keys(result)})

out_file.parent.mkdir(parents=True, exist_ok=True)
out_file.write_text(json.dumps(fixtures, indent=1), encoding="utf-8")
print(f"wrote {len(fixtures)} cases to {out_file}")
