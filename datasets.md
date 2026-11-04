# SafeHer dataset register

## CrimeDataBD (current incident source)

- **Local file:** `backend/data/crimedatabd.csv`
- **Upstream record:** [CrimeDataBD v4, Mendeley Data](https://data.mendeley.com/datasets/d7vzpcdzcw/4)
- **Citation:** Faisal Tareque Shohan, Abu Ubaida Akash, Muhammad Ibrahim, and Mohammad Shafiul Alam (2025), DOI [10.17632/d7vzpcdzcw.4](https://doi.org/10.17632/d7vzpcdzcw.4).
- **Version date:** 9 June 2025 (version 4).
- **License:** CC BY-NC 4.0. Give attribution and do not use commercially without resolving the non-commercial restriction.
- **Contents:** 6,574 Bangladesh crime records. The project archive also contains an identical copy under `CrimeDataBD A Standard Dataset of Crime Records in/Bangladesh-Crime-Dataset.csv`; keep the backend copy canonical.
- **Limitations:** News-derived, approximate incident locations; no year field and no victim-gender field. Do not describe these as female-only records, model training labels, or verified police incident locations.
- **Use in SafeHer:** The graph precompute filters coordinates to a 5 km radius around the configured Chattogram graph center before KDE scoring. The map displays only aggregate counts in approximately 1 km cells within the same area; community-submitted reports are a separate data layer. The source spans Bangladesh, so use outside that graph must apply an appropriate geographic filter.

## Other candidate sources

The supplied research note names `mjtbasif/Bangladesh-Crime-Data` and other potentially useful sources, but they are not present in this project and have not been integrated. The repository's official provenance, schema, license, geographic precision, and suitability have not been verified. Do not call it official police data or use it for trend validation until those checks are complete. Aggregated police statistics can support trend context but cannot replace point-level routing inputs.

## Model and interpretation

CrimeDataBD is one heuristic component in route scoring. Its density score is not a prediction of an individual's risk, a guarantee of safety, or an official crime rate. Keep dataset provenance visible in product and technical documentation.
