# Dashboard motion checks

These five browser runs used the compiled web assets, a local API and isolated synthetic fixtures. They cover the Live minute chart, Models and Live selection, Projects and Providers selection, Runtime Map inspection, History detail focus, Alerts severity changes and newly observed aggregate groups on Cost and related pages. The [stage list](checks.json) and [five original reports](browser-evidence.tar.gz) identify the build, measured cases and capture limitations.

The Live chart changed only the observed points, kept its axes stable and stopped motion when paused, outside the viewport or in reduced motion. Document visibility was simulated. Native window minimization requires separate evidence.

The aggregate test verified identity, finite browser animation duration and cleanup. In the first run, the browser finished one Models provider-row animation at 180 ms, but the animation-frame sampler missed a near-final running frame. The report retains this sampling gap. These checks do not quantify likeness to the concept.
A [second run](aggregate-repeat.tar.gz) of the same aggregate suite, with the same build and default renderer, sampled all required intervals and reported zero sampling gaps.
