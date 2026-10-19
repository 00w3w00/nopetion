"""Build PDF font assets with fonttools==4.60.2; inputs are documented in fonts/README.md.

Usage: python scripts/build-pdf-fonts.py KR.ttf SC.ttf NotoSans.ttf output-directory
Builds and runtime exports use the checked-in assets and never download fonts.
"""

from pathlib import Path
import sys
import tempfile
import hashlib

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def static_font(path, weight):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    cache = Path(tempfile.gettempdir()) / "nopetion-pdf-font-instances"
    cache.mkdir(exist_ok=True)
    instance = cache / f"{digest}-{weight}-fonttools-4.60.2.ttf"
    if instance.exists():
        return TTFont(instance)
    font = TTFont(path)
    axes = {axis.axisTag: axis.defaultValue for axis in font["fvar"].axes}
    axes["wght"] = weight
    instantiateVariableFont(font, axes, inplace=True)
    font.save(instance)
    return font


def build(inputs, output):
    output.mkdir(parents=True, exist_ok=True)
    for weight, style in [(400, "Regular"), (700, "Bold")]:
        with tempfile.TemporaryDirectory() as scratch:
            paths = []
            covered = set()
            for index, source in enumerate(inputs):
                font = static_font(source, weight)
                # PDFKit lays out horizontal baselines itself. The upstream CJK
                # BASE table retains a variable store even after full instancing;
                # it is unused here and cannot be merged by FontTools.
                for table in ["BASE", "vhea", "vmtx", "STAT"]:
                    if table in font:
                        del font[table]
                additions = set(font.getBestCmap()) - covered
                if index:
                    options = subset.Options()
                    options.recommended_glyphs = True
                    subsetter = subset.Subsetter(options=options)
                    subsetter.populate(unicodes=additions)
                    subsetter.subset(font)
                covered.update(additions)
                path = Path(scratch) / f"{index}.ttf"
                font.save(path)
                paths.append(str(path))
            font = Merger().merge(paths)
            names = {
                1: "Nopetion PDF Sans",
                2: style,
                3: f"Nopetion PDF Sans {style} 1.0",
                4: f"Nopetion PDF Sans {style}",
                6: f"NopetionPdfSans-{style}",
                16: "Nopetion PDF Sans",
                17: style,
                0: "Copyright 2014-2021 Adobe; Copyright 2022 The Noto Project Authors",
                13: "SIL Open Font License 1.1; see the accompanying OFL files.",
                14: "https://openfontlicense.org/",
            }
            for name_id, value in names.items():
                font["name"].setName(value, name_id, 3, 1, 0x409)
                font["name"].setName(value, name_id, 1, 0, 0)
            font.save(output / f"NopetionPdfSans-{style}.ttf")
            print(f"{style}: {len(font.getBestCmap())} code points")


if __name__ == "__main__":
    build([Path(arg) for arg in sys.argv[1:4]], Path(sys.argv[4]))
