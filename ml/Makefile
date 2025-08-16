PY=python3

download:        ## 先手動下載資料後，這個目標只做解壓與整形
	$(PY) src/utils_io.py --task unzip_all

prep_writing:
	$(PY) src/writing_dataset.py --task prepare_asap

train_writing:
	$(PY) src/train_writing_baseline.py

prep_speaking:
	$(PY) src/speech_features.py --task extract --manifest ml/data/speaking_manifest.csv

train_speaking:
	$(PY) src/train_speaking_features.py

fuse:
	$(PY) src/fuse_scores.py

calibrate:
	$(PY) src/calibrate_band.py
