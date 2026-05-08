/*
 * waypoints.js
 *
 * Journey waypoints for "Becoming Ilona: Judy's Wartime Path, 1937 to 1949."
 * Each entry maps to one scrollable card on the left and one map fly-to on the right.
 *
 * All historical claims are sourced from:
 *  - Azrieli Foundation Holocaust Survivor Memoirs Program, "Tenuous Threads" (2011)
 *  - Re:Collection digital archive (recollection.azrielifoundation.org)
 *  - USHMM Holocaust Encyclopedia (encyclopedia.ushmm.org)
 *  - Yad Vashem archives
 *
 * Geographic coordinates are verified against published memoir geography and
 * standard gazetteer entries.
 *
 * Edit body text in this file. Coordinates and zoom levels are tuned for the
 * Stamen Terrain tile set; adjust zoom by 1 step at a time and reload.
 */

window.JOURNEY_WAYPOINTS = [
  {
    id: "budapest-1937",
    title: "Budapest, 1937",
    subtitle: "Birth.",
    coords: [47.4979, 19.0402],
    zoom: 11,
    body: "Judit Grünfeld is born on 28 April 1937 to a Hungarian Jewish family in Budapest. The family lives in the city's Pest district. Before the war, Judy is called Jutka or Juditka by her family, the affectionate Hungarian forms of her given name.",
    citation: "Source: Azrieli Foundation Holocaust Survivor Memoirs Program, Tenuous Threads (2011); Re:Collection digital archive."
  },
  {
    id: "ursulines-1944",
    title: "Ursuline Mother House, Stefánia Street, Budapest, 1944",
    subtitle: "Hiding begins. New name: Ilona Papp.",
    coords: [47.5009, 19.0911],
    zoom: 14,
    body: "In the spring of 1944, after the German occupation of Hungary on March 19, Judy's parents arrange for her to be hidden at the Ursuline Mother House on Stefánia Street in Budapest. She is given a new name, Ilona Papp, and the cover story of a Catholic child temporarily separated from her parents in the Hungarian countryside. The Ursuline nuns teach her Catholic prayers and routines.",
    citation: "Source: Azrieli Foundation Holocaust Survivor Memoirs Program, Tenuous Threads (2011).",
    streetView: {
      label: "View Stefánia Street today",
      url: "https://www.google.com/maps/@47.5009,19.0911,15z"
    }
  },
  {
    id: "pincehely-1944",
    title: "Pincehely, Tolna County, autumn 1944",
    subtitle: "Relocation to escape Allied bombing.",
    coords: [46.7333, 18.4500],
    zoom: 10,
    body: "As Allied bombing intensifies over Budapest in autumn 1944, the Ursulines relocate Judy with members of her rescuer's family to Pincehely, a small town in southwestern Hungary. The displacement is brief but it removes her from the city at the most dangerous moment of the Hungarian deportations.",
    citation: "Source: Azrieli Foundation Holocaust Survivor Memoirs Program, Tenuous Threads (2011); historical context: USHMM Holocaust Encyclopedia, 'Hungary: Deportations.'"
  },
  {
    id: "liberation-1945",
    title: "Budapest, January 18, 1945",
    subtitle: "Liberation.",
    coords: [47.4979, 19.0402],
    zoom: 12,
    body: "Soviet forces liberate Pest on January 18, 1945. Buda is liberated on February 13. Judy is reunited with her mother. Both of her parents survived the war: they were deported as 'exchange Jews' to Bergen-Belsen and survived. The family begins rebuilding life in postwar Budapest.",
    citation: "Source: USHMM Holocaust Encyclopedia, 'Liberation of Budapest'; Azrieli Foundation, Tenuous Threads (2011)."
  },
  {
    id: "montreal-1949",
    title: "Montreal, 1949",
    subtitle: "Emigration to Canada.",
    coords: [45.5019, -73.5674],
    zoom: 10,
    body: "In 1949, the family emigrates to Montreal as part of the postwar Canadian Jewish refugee resettlement. Judy grows up in Canada, becomes a French teacher, and decades later writes Tenuous Threads as her testimony for the Azrieli Foundation Holocaust Survivor Memoirs Program.",
    citation: "Source: Azrieli Foundation Holocaust Survivor Memoirs Program, Tenuous Threads (2011)."
  },
  {
    id: "memoir-2011",
    title: "Tenuous Threads, published 2011",
    subtitle: "Testimony.",
    coords: [43.6532, -79.3832],
    zoom: 4,
    body: "Judy Abrams' memoir Tenuous Threads is published in 2011 by the Azrieli Foundation Holocaust Survivor Memoirs Program in association with Second Story Press. The Foundation distributes the memoir at no cost to Canadian educators, school libraries, and post-secondary instructors as part of an ongoing program to preserve and share the first-person accounts of Holocaust survivors who came to Canada.",
    citation: "Source: Azrieli Foundation Holocaust Survivor Memoirs Program."
  }
];
