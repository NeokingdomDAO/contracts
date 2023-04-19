#!/bin/bash

# Set input and output filenames
input_md="WHITEPAPER.md"
output_pdf="WHITEPAPER.pdf"

# Get the short version of the current Git commit hash
gitcommit=$(git rev-parse --short HEAD)

# Set the title and subtitle of the document
title="DRAFT: NEOKingdom Whitepaper"
subtitle="(rev $gitcommit)"

# Run Pandoc to generate the PDF with the current date and Git commit hash in the subtitle
pandoc -s "$input_md" -o "$output_pdf" --pdf-engine=xelatex -V title="$title" -V subtitle="$subtitle"
