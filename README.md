# Unmasked 

A Chrome browser extension that detects and highlights manipulative UX patterns (dark patterns) in real time using NLP-based text classification.

Built as part of a bachelor's thesis at SWPS University, Warsaw (2026).

---

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `extension/` folder
5. The Unmasked icon will appear in your Chrome toolbar

> **Optional:** To enable AI-powered explanations, add your OpenAI API key in the extension settings panel.

---

## What It Does

Unmasked scans the text content of any webpage and flags manipulative interface copy across nine dark pattern categories:

| Category | Example |
|---|---|
| Scarcity | "Only 2 left in stock!" |
| Urgency | "Offer ends in 10:00 minutes" |
| Social Proof | "43 people are viewing this" |
| Misdirection | Confusing opt-out wording |
| ... | ... |

Detected elements are highlighted directly on the page with colour-coded severity indicators (critical / warning / info). A popup panel shows pattern cards with explanations of the psychological mechanism behind each flagged element.

---

## How It Works

The extension uses a **JavaScript rule-based classifier** derived from a trained **Logistic Regression + TF-IDF** NLP model:

- **Dataset:** 2,356 labelled interface text segments (Mathur et al., 2019)
- **Binary detection:** F1 = 0.936, ROC AUC = 0.976
- **Multiclass (9 categories):** macro F1 = 0.891

The top lexical features identified by the model (e.g. *left, limited, hurry, people, bought*) were encoded as explicit keyword rules in the extension, keeping it fully offline with no external API calls required for classification.

---

## Repo Structure

```
unmasked/
├── extension/          # Chrome extension source (JS, HTML, CSS)
│   ├── manifest.json
│   ├── content.js      # DOM text extraction + highlight injection
│   ├── background.js   # Classification pipeline (service worker)
│   └── popup/          # Extension popup UI
├── notebooks/
│   └── dark_patterns_analysis.ipynb   # NLP model training & evaluation
├── data/               # Dataset info (see notebook for source)
└── README.md
```

---

## NLP Notebook

The `notebooks/dark_patterns_analysis.ipynb` notebook covers:

- Data loading and preprocessing
- TF-IDF vectorisation and feature engineering
- Training and comparison of 5 classifiers
- Binary and multiclass evaluation (confusion matrices, ROC curves, feature importance)

Requirements: `scikit-learn`, `pandas`, `numpy`, `matplotlib`, `seaborn`

```bash
pip install scikit-learn pandas numpy matplotlib seaborn
jupyter notebook notebooks/dark_patterns_analysis.ipynb
```

---

## Thesis

This extension was developed as part of the bachelor's thesis:

> Stępień, K. (2026). *NLP-Based Detection of Manipulative UX Patterns in Web Interfaces*. SWPS University, Warsaw.

---

## License

MIT
