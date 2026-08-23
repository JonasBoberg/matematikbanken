// --- Supabase klient ---
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"
import { taskGroups } from './uppgiftsbank.012.js';

// TEMPORÄRT INAKTIVERAT AUTH
// För att återaktivera senare: byt ut den aktiva auth-blocken längre ned mot den kommenterade koden härunder.
/*
// --- Original auth-logik (sparad som backup) ---
console.log("AUTH CHECK STARTAR");

document.body.style.display = "none";

const supabase = createClient("https://fmbmwbhcngtjkfvtvgcx.supabase.co", "sb_publishable_L0aRR9ZevImAgl0moi20MQ_bp80Xf67", {
  auth: {
    persistSession: true,
    storage: localStorage
  }
});

async function initAuth() {
    console.log("Startar auth...");

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        console.error("Fel vid session:", sessionError);
        return;
    }

    if (!session) {
        console.log("→ Ingen session, till login");
        window.location.href = "./login.html";
        return;
    }

    const user = session.user;
    console.log("Inloggad användare:", user.id, user.email);

    const userInfoDiv = document.getElementById("userInfo");
    if (userInfoDiv) {
        userInfoDiv.innerHTML = `
            <span id="userEmail">${user.email}</span>
            <button id="logoutBtn" style="margin-left: 10px; cursor: pointer;">Logga ut</button>
        `;

        const logoutBtn = document.getElementById("logoutBtn");
        logoutBtn.addEventListener("click", async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("Logout error:", error);
                alert("Kunde inte logga ut");
                return;
            }
            console.log("Utloggad!");
            window.location.href = "./login.html";
        });
    }

    const { data: subData, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (subError) {
        console.error("Fel vid hämtning av subscription:", subError);
    }

    if (!subData) {
        const { data: insertData, error: insertError } = await supabase
            .from("subscriptions")
            .insert([{ user_id: user.id, status: "trial" }]);

        if (insertError) {
            console.error("Kunde inte skapa subscription:", insertError);
        } else {
            console.log("Ny subscription skapad för användaren:", insertData);
        }
    } else {
        console.log("Subscription finns redan:", subData);
    }

    document.body.style.display = "block";
    console.log("→ Sidan klar att visas");
}

initAuth();
document.body.classList.remove("auth-loading");
*/

function flattenTasks(groups) {
    const flatList = [];

    groups.forEach(group => {
        const { versions, ...sharedProps } = group;

        // NYA FORMATET (med versions)
        if (versions && versions.length > 0) {
            versions.forEach(ver => {
                flatList.push({
                    ...sharedProps,
                    ...ver
                });
            });
        } 
        // GAMLA FORMATET (utan versions)
        else {
            flatList.push({
                ...sharedProps,
                // säkerställ att vissa fält finns
                id: group.id,
                question: group.question,
                solution: group.solution,
                versionLabel: group.versionLabel || null
            });
        }
    });

    return flatList;
}

// Skapa variabeln 'tasks' som resten av din kod använder
const tasks = flattenTasks(taskGroups);
window.tasks = tasks;

// Aktuell, temporär version: auth är avstängt men koden lämnas lätt att återaktivera.
console.log("AUTH är temporärt inaktiverat");

document.body.style.display = "block";
document.body.classList.remove("auth-loading");

const userInfoDiv = document.getElementById("userInfo");
if (userInfoDiv) {
    userInfoDiv.innerHTML = `
        <span id="userEmail">Demo-användare</span>
        <button id="logoutBtn" style="margin-left: 10px; cursor: pointer;">Logga ut</button>
    `;
}


// --- Tillståndsvariabler ---
let selectedTaskIds = []; // Array för att kunna sortera
let currentFilter = { area: null, subArea: null };
let currentCourse = null;
let selectedDifficulties = [];
let customTaskImgWidths = {}; // Lagrar manuellt ändrade bildbredder per uppgift
let customTextBlocks = {}; // Lagrar innehållet: { -1: "Min text...", -2: "Mer text..." }
let nextCustomId = -1;     // Används för att ge unika negativa ID
let extraBrSpacing = false; // Visa extra utrymme vid <br>
let customTextDebounceTimer = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- Dropdown & Event Listeners ---
window.toggleDropdown = function(id) {
    const dropdown = document.getElementById(id);
    dropdown.classList.toggle('open');
};

window.addEventListener('click', function(e) {
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    dropdowns.forEach(dropdown => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });
});

function buildAreaMenu() {
    const areaMap = {};
    tasks.forEach(task => {
        if (!task.area) return;
        if (!areaMap[task.area]) areaMap[task.area] = new Set();
        if (task.subArea) areaMap[task.area].add(task.subArea);
    });

    const container = document.getElementById('areaDropdownContent');
    let html = `<div class="dropdown-item" onclick="selectArea('all', null)">Alla områden</div>`;

    for (const area in areaMap) {
        html += `
            <div class="dropdown-item" onclick="toggleAreaGroup(this, event)">
                <span class="toggle-arrow">▸</span> ${area}
            </div>
            <div class="sub-items">
                <div class="sub-item" onclick="selectArea('${area}', null)">Alla inom ${area}</div>
                ${Array.from(areaMap[area]).map(sub => 
                    `<div class="sub-item" onclick="selectArea('${area}', '${sub}')">${sub}</div>`
                ).join('')}
            </div>
        `;
    }
    container.innerHTML = html;
}

window.toggleAreaGroup = function(element, event) {
    event.stopPropagation();
    element.classList.toggle('expanded');
}

window.selectArea = function(area, subArea) {
    currentFilter = { area, subArea };
    const label = document.getElementById('areaDropdownLabel');
    if (area === 'all') label.innerText = "Alla områden";
    else if (subArea === null) label.innerText = area;
    else label.innerText = `${area} - ${subArea}`;
    document.getElementById('areaDropdown').classList.remove('open');
    filterTasks();
}

window.selectCourse = function(course) {
    currentCourse = course;
    const label = document.getElementById('courseDropdownLabel');
    label.innerText = (course === 'all') ? 'Alla kurser' : course;
    document.getElementById('courseDropdown').classList.remove('open');
    filterTasks();
}

// Hantera klick på en specifik nivå
window.toggleDifficultyCheckbox = function(event, level) {
    event.stopPropagation(); // Viktigt: förhindra att dropdown stängs

    // Hitta checkboxen inuti den rad vi klickade på
    const checkbox = event.currentTarget.querySelector('input[type="checkbox"]');

    // 1. Uppdatera vår data-array
    if (selectedDifficulties.includes(level)) {
        selectedDifficulties = selectedDifficulties.filter(l => l !== level);
    } else {
        selectedDifficulties.push(level);
    }

    // 2. Tvinga checkboxen att spegla datan
    const shouldBeChecked = selectedDifficulties.includes(level);
    checkbox.checked = shouldBeChecked;

    updateDifficultyUI();
    filterTasks();
}


// Uppdatera texten på dropdown-knappen
function updateDifficultyUI() {
    const label = document.getElementById('difficultyDropdownLabel');
    const allDifficulties = [...new Set(tasks.map(t => t.difficulty))].filter(d => d != null);
    
    if (selectedDifficulties.length === 0) {
        label.innerText = "Ingen nivå vald";
    } else if (selectedDifficulties.length === allDifficulties.length) {
        label.innerText = "Alla nivåer";
    } else {
        // Visa valda nivåer kommaseparerat (t.ex. "Nivå: 1, 2")
        label.innerText = "Nivå: " + selectedDifficulties.sort((a,b) => a-b).join(", ");
    }
}

// --- Initiera Filter ---
function initFilters() {
    buildAreaMenu();

    // Kurser (Oförändrat)
    const allCourses = tasks.flatMap(t => t.courses);
    const uniqueCourses = [...new Set(allCourses)].sort();
    const container = document.getElementById('courseDropdownContent');
    let html = `<div class="dropdown-item" onclick="selectCourse('all')">Alla kurser</div>`;
    uniqueCourses.forEach(course => {
        html += `<div class="dropdown-item" onclick="selectCourse('${course}')">${course}</div>`;
    });
    container.innerHTML = html;

        // --- NY LOGIK FÖR SVÅRIGHETSGRAD (ENBART NIVÅER) ---
    const difficulties = [...new Set(tasks.map(t => t.difficulty))].filter(d => d != null).sort((a, b) => a - b);
    const diffContainer = document.getElementById('difficultyDropdownContent');
    
    // Starta med alla nivåer valda
    selectedDifficulties = [...difficulties];

    let diffHtml = "";

    difficulties.forEach(diff => {
        diffHtml += `
            <div class="dropdown-item" onclick="toggleDifficultyCheckbox(event, ${diff})">
                <input type="checkbox" value="${diff}" checked> Nivå ${diff}
            </div>
        `;
    });
    diffContainer.innerHTML = diffHtml;
}

function getLayoutConfig(layoutValue) {

    const isTwoColumn =
        layoutValue === "two" ||
        layoutValue === "2" ||
        layoutValue === "two-col";

    return {
        isTwoColumn,
        wrapperClass: isTwoColumn ? "layout-two" : "layout-one"
    };
}

function displayTasks(filteredTasks) {
    const container = document.getElementById("taskContainer");
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    // 1. Gruppera uppgifterna
    const groupedTasks = {};
    filteredTasks.forEach(task => {
        const key = task.groupId || `single_${task.id}`;
        if (!groupedTasks[key]) groupedTasks[key] = [];
        groupedTasks[key].push(task);
    });

    // 2. Rendera varje grupp
    for (const key in groupedTasks) {
        const group = groupedTasks[key];
        const mainTask = group[0]; // Ta första uppgiften som "huvuduppgift" för info

        const areaTags = mainTask.subArea ? `${mainTask.area} - ${mainTask.subArea}` : mainTask.area;
        const courseTags = mainTask.courses.join(", ");
        const calcIconWeb = mainTask.calculator ? '<span style="margin-left:10px;" title="Miniräknare tillåten">📱</span>' : "";
        const imgHtml = mainTask.img ? `<img src="${mainTask.img}" alt="Uppgiftsbild">` : "";

        const taskDiv = document.createElement("div");
        taskDiv.className = "task";
        taskDiv.style.position = "relative";

        // Använd question för förhandsvisning om det finns, annars example
        const previewText = mainTask.question || mainTask.example || "";

        taskDiv.innerHTML = `
            <div style="padding-right: 45px;">
                <label style="cursor: pointer; display: block;">
                    <input type="checkbox" value="${mainTask.id}" ${selectedTaskIds.includes(mainTask.id) ? "checked" : ""}>
                    <strong>${areaTags}</strong> ${calcIconWeb}<br>
                    <small style="color: var(--text-muted);">Kurser: ${courseTags}</small><br>
                    <small style="color: var(--text-muted);">Nivå: ${mainTask.difficulty || ''}</small>
                    <p>${parseContent(previewText, mainTask.id)}</p>
                    ${imgHtml}
                </label>
            </div>
            <div class="version-selector" style="position: absolute; right: 5px; top: 5px; display: flex; flex-direction: column; align-items: flex-end;"></div>
        `;

        const versionSelector = taskDiv.querySelector('.version-selector');
        const mainCheckbox = taskDiv.querySelector('input[type="checkbox"]');
        
        // Container för vanliga versionsknappar (A, B, C...)
        //const versionsContainer = document.createElement('div');
        //versionsContainer.style.display = 'flex';
        //versionsContainer.style.gap = '2px';
        //versionsContainer.style.marginBottom = '5px'; // Lite mellanrum till exemplen


        // Container för vanliga versionsknappar (A, B, C...)
        //const versionsContainer = document.createElement('div');
        //versionsContainer.style.display = 'grid';
        //versionsContainer.style.gridTemplateColumns = 'repeat(6, auto)'; // Max 6 knappar per rad
        //versionsContainer.style.gap = '2px';
        //versionsContainer.style.marginBottom = '5px'; // Lite mellanrum till exemplen
        //versionsContainer.style.justifyContent = 'end'; // Håller knapporna högerjusterade om de radbryt//s//


        // Container för Exempelknappar (under versionsknapparna)
        //const examplesContainer = document.createElement('div');
        //examplesContainer.style.gap = '2px';


        // Gemensam container för ALLA knappar
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexWrap = 'wrap';
        buttonsContainer.style.gap = '2px';
        buttonsContainer.style.justifyContent = 'flex-end'; 
        buttonsContainer.style.marginBottom = '5px';

        let normalVersionCount = 0;
        let hasAddedExampleSpacer = false;




        // HJÄLPFUNKTION: Uppdatera hela rutans utseende
        const updateContainerStyle = () => {
            const hasSelection = group.some(t => selectedTaskIds.includes(t.id));
            if (hasSelection) {
                taskDiv.classList.add('task-group-selected');
            } else {
                taskDiv.classList.remove('task-group-selected');
            }
        };

        updateContainerStyle();

        let mainVersionBtn = null;

        // 3. Skapa versionsknappar
        if (group.length > 1 || (group.length === 1 && group[0].groupId)) {
            group.forEach((verTask) => {
                // Kolla om det är ett exempel
                const isExample = !!verTask.example;

                const btn = document.createElement('div');
                // Använd samma klass för stil
                btn.className = 'version-btn';
                
                btn.style.position = 'relative';
                
                // --- TILLÄGG 1: Spara ID på knappen för att kunna hitta den senare ---
                btn.dataset.id = verTask.id; 
                // -------------------------------------------------------------------
                
                if (selectedTaskIds.includes(verTask.id)) btn.classList.add('selected');
                
                btn.innerText = verTask.versionLabel || "A";
                if (isExample) {
                    btn.innerText = "Ex";
                }
                
                // Preview
                const previewDiv = document.createElement('div');
                previewDiv.className = 'version-preview';

                // --- TILLÄGG: Tvinga positioneringen att följa knappen ---
                previewDiv.style.position = 'absolute';
                previewDiv.style.top = '100%';       // Startar precis nedanför knappen
                previewDiv.style.right = '10px';      // Skjuter den lite åt vänster (snett)
                previewDiv.style.marginTop = '5px';  // Lite luft mellan knapp och preview
                previewDiv.style.zIndex = '1000';    // Lägger den ovanpå allt annat (även andra rader)
                // ---------------------------------------------------------
                
                const header = document.createElement('div');
                header.style.cssText = "font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; color: #333;";
                header.innerText = isExample ? `Exempel` : `Version ${verTask.versionLabel}`;
                
                const content = document.createElement('div');
                content.innerHTML = parseContent(isExample ? verTask.example : verTask.question, verTask.id);
                
                previewDiv.appendChild(header);
                previewDiv.appendChild(content);
                
                // --- TILLÄGG 2: Visa bild i previewn om det finns ---
                if (verTask.img) {
                    const img = document.createElement('img');
                    img.src = verTask.img;
                    previewDiv.appendChild(img);
                }
                // -------------------------------------------------------
                
                btn.appendChild(previewDiv);

                // Hover events
                btn.addEventListener('mouseenter', () => {
                    previewDiv.style.display = 'block';
                    if (window.MathJax) MathJax.typesetPromise([previewDiv]);
                });
                btn.addEventListener('mouseleave', () => {
                    previewDiv.style.display = 'none';
                });

                // --- Klick-logik ---
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = verTask.id;
                    const isSelected = selectedTaskIds.includes(id);

                    if (isSelected) {
                        selectedTaskIds = selectedTaskIds.filter(tId => tId !== id);
                        btn.classList.remove('selected');
                    } else {
                        selectedTaskIds.push(id);
                        btn.classList.add('selected');
                    }

                    if (verTask.id === mainTask.id) {
                        mainCheckbox.checked = !isSelected;
                    }

                    updateContainerStyle();
                    updateSelectedListUI();
                    updatePreview();
                });

                // --- NY LOGIK FÖR ATT LÄGGA KNAPPAR I SAMMA CONTAINER MED RADBRYTNING ---
                if (isExample) {
                    // När vi träffar första Ex-knappen, tvinga en ny rad
                    if (!hasAddedExampleSpacer) {
                        const spacer = document.createElement('div');
                        spacer.style.width = '100%';
                        spacer.style.height = '0';
                        spacer.style.overflow = 'hidden';
                        buttonsContainer.appendChild(spacer);
                        hasAddedExampleSpacer = true;
                    }
                    buttonsContainer.appendChild(btn);
                } else {
                    buttonsContainer.appendChild(btn);
                    normalVersionCount++;
                    
                    // Efter varje 6:e vanlig knapp, tvinga en ny rad
                    if (normalVersionCount % 6 === 0) {
                        const spacer = document.createElement('div');
                        spacer.style.width = '100%';
                        spacer.style.height = '0';
                        spacer.style.overflow = 'hidden';
                        buttonsContainer.appendChild(spacer);
                    }
                }
                // -------------------------------------------------------------------------------

                if (verTask.id === mainTask.id && !isExample) {
                    mainVersionBtn = btn;
                }
            });
        }

        versionSelector.appendChild(buttonsContainer);

        // --- Klick-logik för huvudcheckbox ---
        mainCheckbox.addEventListener('change', (e) => {
            const id = parseInt(e.target.value);
            const isSelected = selectedTaskIds.includes(id);

            if (e.target.checked) {
                if (!isSelected) selectedTaskIds.push(id);
                if (mainVersionBtn) mainVersionBtn.classList.add('selected');
            } else {
                selectedTaskIds = selectedTaskIds.filter(tId => tId !== id);
                if (mainVersionBtn) mainVersionBtn.classList.remove('selected');
            }

            updateContainerStyle();
            updateSelectedListUI();
            updatePreview();
        });

        fragment.appendChild(taskDiv);
    }

    container.appendChild(fragment);
    if (window.MathJax) MathJax.typesetPromise([container]);
}

function filterTasks() {
    if (currentFilter.area === null && currentCourse === null && currentDifficulty === null) {
        displayTasks([]);
        return;
    }

    const filtered = tasks.filter(task => {
        let areaMatch = true;
        if (currentFilter.area !== null && currentFilter.area !== 'all') {
            if (task.area !== currentFilter.area) areaMatch = false;
            if (currentFilter.subArea !== null && task.subArea !== currentFilter.subArea) areaMatch = false;
        }

        let courseMatch = true;
        if (currentCourse !== null && currentCourse !== 'all') {
            courseMatch = task.courses.includes(currentCourse);
        }

        // UPPDATERAD LOGIK FÖR SVÅRIGHET
        let difficultyMatch = true;
    
        // Om vi har valt nivåer, kolla om uppgiften är med i listan
        if (selectedDifficulties.length > 0) {
            difficultyMatch = selectedDifficulties.includes(task.difficulty);
        } else {
            // Om inga nivåer är valda, visa ingen uppgift (eller ändra till 'true' om du vill visa alla)
            difficultyMatch = false; 
        }

    return areaMatch && courseMatch && difficultyMatch;
    });

    displayTasks(filtered);
}

function clearSelection() {
    selectedTaskIds = [];
    updateSelectedListUI();
    filterTasks();
    updatePreview();
}


// Lägg till en ny tom textruta
window.addCustomTextBlock = function() {
    const id = nextCustomId--;
    customTextBlocks[id] = { content: "" }; // Spara tomt innehåll
    selectedTaskIds.push(id); // Lägg till i listan över valda saker
    
    updateSelectedListUI();
    updatePreview();
    
    // Scrolla till botten av listan
    setTimeout(() => {
        const list = document.getElementById('selectedList');
        if (!list) return;
        const lastChild = list.lastElementChild;
        if (!lastChild) return;
        lastChild.scrollIntoView({ behavior: 'smooth' });

        // Fokusera på den nya textarean
        const textarea = lastChild.querySelector('textarea');
        if (textarea) textarea.focus();
    }, 100);
};

// Uppdatera innehållet när användaren skriver
window.updateCustomTextContent = function(id, newText, render = true) {
    if (customTextBlocks[id]) {
        customTextBlocks[id].content = newText;
        if (render) {
            updatePreview(); // Uppdatera förhandsgranskningen när användaren lämnar redigeringen
        }
    }
};



function createBarChart(dataStr) {
    const lines = dataStr.trim().split('\n');
    const data = lines.map(line => {
        const parts = line.split('|').map(p => p.trim());
        return { label: parts[0], value: parseFloat(parts[1]) || 0 };
    });

    if (data.length === 0) return '';

    const maxVal = Math.max(...data.map(d => d.value));
    const chartWidth = 300;
    const chartHeight = 170; 
    const barWidth = 30;
    const gap = 10;
    const startX = 40;
    const startY = 30; 

    let svg = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="math-chart" style="display: block; width: 100%; height: auto;">`;
    
    // X-axelns position (höjd - bottenmarginal)
    const xAxisY = chartHeight - startY;
    
    // Rita axlar
    svg += `<line x1="${startX}" y1="${xAxisY}" x2="${chartWidth - 10}" y2="${xAxisY}" stroke="currentColor" stroke-width="1"/>`;
    svg += `<line x1="${startX}" y1="${xAxisY}" x2="${startX}" y2="10" stroke="currentColor" stroke-width="1"/>`;

    data.forEach((d, i) => {
        const x = startX + 10 + (i * (barWidth + gap));
        // Anpassa stapelhöjden efter den nya axelpositionen
        const barHeight = (d.value / maxVal) * (xAxisY - 40); // 40px marginal uppåt
        const y = xAxisY - barHeight;

        svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="var(--primary-light)" stroke="var(--primary)" stroke-width="1"/>`;
        
        // Etikett (placeras 15px under x-axeln)
        svg += `<text x="${x + barWidth/2}" y="${xAxisY + 15}" text-anchor="middle" font-size="10px" fill="var(--text-main)">${d.label}</text>`;
        
        // Värde (ovanför stapeln)
        svg += `<text x="${x + barWidth/2}" y="${y - 3}" text-anchor="middle" font-size="10px" fill="var(--text-main)">${d.value}</text>`;
    });

    svg += '</svg>';
    return svg;
}

function createLineChart(dataStr) {
    const lines = dataStr.trim().split('\n');
    if (lines.length === 0) return '';

    // Standardinställningar
    let options = {
        ystep: null,
        showValues: false
    };

    let dataLines = [];

    // Kolla om första raden innehåller inställningar
    const firstLine = lines[0].toLowerCase();
    
    // Om första raden inte ser ut som data (har inga kommatecken), tolka den som inställningar
    if (!lines[0].includes(',')) {
        // Hantera ystep (t.ex. ystep=20)
        const ystepMatch = firstLine.match(/ystep=(\d+)/);
        if (ystepMatch) {
            options.ystep = parseInt(ystepMatch[1]);
        }
        // Hantera showValues
        if (firstLine.includes('showvalues')) {
            options.showValues = true;
        }
        dataLines = lines.slice(1); // Resten är data
    } else {
        dataLines = lines; // Allt är data
    }

    const points = dataLines.map(line => {
        const parts = line.split(',').map(p => parseFloat(p.trim()));
        return { x: parts[0], y: parts[1] };
    });

    if (points.length === 0) return '';

    // --- KORRIGERING AV X-AXELN ---
    // Beräkna min och max för X för att skala axeln korrekt
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const xRange = (maxX - minX) || 1; // Undvik division med noll om alla x är samma

    // Beräkna maxvärden för Y
    const minY = 0; 
    let maxY = Math.max(...points.map(p => p.y));
    
    // Om ystep är satt, justera maxY för att passa sista steget
    if (options.ystep) {
        maxY = Math.ceil(maxY / options.ystep) * options.ystep;
    } else {
        maxY = maxY * 1.1; // Lägg till 10% luft om ingen gradning
    }

    const chartWidth = 300;
    const chartHeight = 170; 
    const paddingX = 40; // Vänstermarginal
    const paddingY = 20; // Toppmarginal

    // Uppdaterade skalningsfunktioner
    const plotWidth = chartWidth - paddingX - 15; // Bredden på själva ritområdet
    
    // X skalar nu baserat på (x - minX) istället för (x / maxX)
    const scaleX = (x) => paddingX + ((x - minX) / xRange) * plotWidth;
    
    const scaleY = (y) => (chartHeight - paddingY - 20) - ((y - minY) / (maxY - minY)) * (chartHeight - paddingY - 40);

    let svg = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" class="math-chart" style="display: block; width: 100%; height: auto;">`;
    
    // 1. Rita Y-axelns gradning (horizontal lines)
    if (options.ystep) {
        for (let y = minY; y <= maxY; y += options.ystep) {
            const yPos = scaleY(y);
            // Hjälplinjer (streckade)
            svg += `<line x1="${paddingX}" y1="${yPos}" x2="${chartWidth - 10}" y2="${yPos}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>`;
            // Etiketter till vänster
            svg += `<text x="${paddingX - 5}" y="${yPos + 3}" text-anchor="end" font-size="10px" fill="var(--text-muted)">${y}</text>`;
        }
    }

    // 2. Rita axlarna
    const xAxisY = scaleY(minY);
    svg += `<line x1="${paddingX}" y1="${xAxisY}" x2="${chartWidth - 10}" y2="${xAxisY}" stroke="currentColor" stroke-width="1"/>`; // X-axel
    svg += `<line x1="${paddingX}" y1="${scaleY(minY)}" x2="${paddingX}" y2="${scaleY(maxY)}" stroke="currentColor" stroke-width="1"/>`; // Y-axel

    // 3. Rita linjen
    const pathData = points.map(p => `${scaleX(p.x)},${scaleY(p.y)}`).join(' L ');
    svg += `<path d="M ${pathData}" fill="none" stroke="var(--primary)" stroke-width="2"/>`;

    // 4. Rita punkter, X-etiketter och ev. värden
    points.forEach(p => {
        const cx = scaleX(p.x);
        const cy = scaleY(p.y);

        // Punkt
        svg += `<circle cx="${cx}" cy="${cy}" r="3" fill="var(--primary)"/>`;

        // X-etikett (År/Tal under axeln)
        svg += `<text x="${cx}" y="${xAxisY + 15}" text-anchor="middle" font-size="10px" fill="var(--text-main)">${p.x}</text>`;

        // Visa värde ovanför punkten om showValues är true
        if (options.showValues) {
            svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="10px" font-weight="bold" fill="var(--text-main)">${p.y}</text>`;
        }
    });

    svg += '</svg>';
    return svg;
}



function createFunctionPlot(dataStr) {
    let showGrid = false;
    const lines = dataStr.trim().split('\n').map(l => l.trim()).filter(Boolean);

    let xMin = -5, xMax = 5;
    let step = 0.1;
    let xStep = 1;
    let yStep = 1;
    const functions = [];

    lines.forEach(line => {
        if (line.startsWith('x=')) {
            const [a, b] = line.replace('x=', '').split('..').map(Number);
            xMin = a;
            xMax = b;
        } else if (line === 'grid=true') {
            showGrid = true;
        } else if (line.startsWith('step=')) {
            step = parseFloat(line.replace('step=', ''));
        } else if (line.startsWith('xstep=')) {
            xStep = parseFloat(line.replace('xstep=', ''));
        } else if (line.startsWith('ystep=')) {
            yStep = parseFloat(line.replace('ystep=', ''));
        } else {
            const match = line.match(/^([a-zA-Z])\(x\)=(.+)$/);
            if (match) functions.push({ expr: match[2] });
        }
    });

    const width = 620;
    const height = 450;
    const pad = 15;

    const points = [];

    functions.forEach(fn => {
        const p = [];
        for (let x = xMin; x <= xMax; x += step) {
            try {
                const y = Function('x', `return ${fn.expr}`)(x);
                if (Number.isFinite(y)) p.push({ x, y });
            } catch {}
        }
        points.push(p);
    });

    const allY = points.flat().map(p => p.y);
    const yMin = Math.min(...allY, -1);
    const yMax = Math.max(...allY, 1);

    const sx = x => pad + ((x - xMin) / (xMax - xMin)) * (width - 2 * pad);
    const sy = y => height - pad - ((y - yMin) / (yMax - yMin)) * (height - 2 * pad);

    // Skapa SVG FÖRST
    let svg = `<svg viewBox="0 0 ${width} ${height}" class="math-chart">`;

    // Beräkna axlarnas nollpunkter
    const x0 = (0 >= xMin && 0 <= xMax) ? sx(0) : pad;
    const y0 = (0 >= yMin && 0 <= yMax) ? sy(0) : height - pad;


    if (showGrid) {

    // Vertikala gridlinjer
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        const px = sx(x);
        svg += `<line x1="${px}" y1="${pad}" x2="${px}" y2="${height - pad}"
                     stroke="#b8b8b8" stroke-width="2"/>`;
    }

    // Horisontella gridlinjer
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        const py = sy(y);
        svg += `<line x1="${pad}" y1="${py}" x2="${width - pad}" y2="${py}"
                     stroke="#b8b8b8" stroke-width="2"/>`;
    }
    }



    // Rita axlar
    svg += `<line x1="${pad}" y1="${y0}" x2="${width - pad}" y2="${y0}" stroke="currentColor"/>`;
    svg += `<line x1="${x0}" y1="${pad}" x2="${x0}" y2="${height - pad}" stroke="currentColor"/>`;

    // X-gradering
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        const px = sx(x);
        svg += `<line x1="${px}" y1="${y0 - 4}" x2="${px}" y2="${y0 + 4}" stroke="currentColor"/>`;
        svg += `<text x="${px}" y="${y0 + 14}" font-size="17" text-anchor="middle">${x}</text>`;
    }

    // Y-gradering
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        const py = sy(y);
        svg += `<line x1="${x0 - 4}" y1="${py}" x2="${x0 + 4}" y2="${py}" stroke="currentColor"/>`;
        if (Math.abs(y) > 1e-6) {
            svg += `<text x="${x0 - 6}" y="${py + 3}" font-size="17" text-anchor="end">${y}</text>`;
        }
    }

    // Rita funktionerna
    const colors = ['#1a48ad', '#b01e1e', '#149142'];

    points.forEach((p, i) => {
        const d = p.map((pt, j) => `${j === 0 ? 'M' : 'L'} ${sx(pt.x)} ${sy(pt.y)}`).join(' ');
        svg += `<path d="${d}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2"/>`;
    });

    svg += `</svg>`;
    return svg;
}

// Uppdaterad parser som hanterar tabeller, diagram OCH inbäddade bilder
function parseContent(text, taskId = null) {
    // 1. Hantera Tabeller
    text = text.replace(/\{table([\s\S]*?)\}/g, function(match, content) {
        const rows = content.trim().split('\n');
        let html = '<table class="task-table">';
        rows.forEach((row, index) => {
            if (row.trim() === '') return;
            const cells = row.split('|').map(cell => cell.trim());
            const tag = (index === 0) ? 'th' : 'td';
            html += '<tr>' + cells.map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
        });
        return html + '</table>';
    });

    // 2. Hantera Stapeldiagram (Bar Chart)
    text = text.replace(/\{barchart([\s\S]*?)\}/g, function(match, content) {
        return createBarChart(content);
    });

    // 3. Hantera Linjediagram (Line Chart)
    text = text.replace(/\{linechart([\s\S]*?)\}/g, function(match, content) {
        return createLineChart(content);
    });
    
    // 4. Funktionsgrafer
    text = text.replace(/\{functionplot([\s\S]*?)\}/g, (m, c) => {
        return createFunctionPlot(c);
    });

    // 5. Hantera inbäddade bilder (Format: img: "bild.jpg" eller img: 'bild.jpg')
    text = text.replace(/img:\s*['"]([^'"]+)['"]/g, function(match, src) {
        let widthStyle = "max-width: 100%; width: 100%;"; // Standardbredd
        // Om bilden har fått en manuellt sparad bredd, använd den
        if (taskId && customTaskImgWidths[taskId]) {
            widthStyle = `width: ${customTaskImgWidths[taskId]}px; max-width: none;`;
        }
        return `<img src="${src}" data-task-id="${taskId || ''}" style="${widthStyle} height: auto; margin: 5px 0; display: block;" alt="Uppgiftsbild">`;
    });

    if (extraBrSpacing) {
        text = text.replace(/<br\s*\/?>/gi, '<br><span class="extra-br-space"></span>');
    }

    return text;
}



// --- NY FUNKTION: BYGG HTML STRÄNG (Delad av Preview och PDF) ---
function buildTasksHTML(tasksList, settings, type) {
    if (tasksList.length === 0) return "";

    const layout = settings.layout;
    const spacing = settings.spacing;
    const imgSize = settings.imgSize;

    let wrapperStyle = "";
    if (layout === "two") {
        wrapperStyle = `display: grid; grid-template-columns: 1fr 1fr; gap: 20px; column-gap: 20px;`;
    } else {
        wrapperStyle = `display: flex; flex-direction: column; gap: 0px;`;
    }

    let tempHtml = `<div class="pdf-wrapper ${layout === 'two' ? 'two-col' : ''}" style="${wrapperStyle}">`;

    tasksList.forEach((task, index) => {
        const calcIconPdf = task.calculator ? '<span style="font-size: 10px; margin-right: 4px;">📱</span>' : '';
        let content = (type === 'solution') ? task.solution : (task.question || task.example);
        content = parseContent(content, task.id);
        let imgTag = "";
        
        if (type === 'question' && task.img) {
            // Använd imgSize från settings
            imgTag = `<div class="pdf-media"><img src="${task.img}" style="width: ${imgSize}% !important;"></div>`;
        }

        // Hantering av exempel: Ram, ingen siffra
        const isExample = !!task.example;
        const taskItemStyle = `
            font-size:10pt; 
            break-inside:avoid; 
            padding-bottom:${spacing}px; 
            width:100%;
            ${isExample ? 'border: 2px solid #000; padding: 10px; box-sizing: border-box;' : ''}
        `;

        const label = isExample 
            ? `<span style="font-weight:bold; display:block; margin-bottom:5px;">Exempel</span>` 
            : `<strong>${index + 1}.</strong>`;

        tempHtml += `
        <div class="task-item" style="${taskItemStyle}">
            <div style="display:flex; align-items:baseline;">
                <div style="flex-shrink:0;">
                    ${calcIconPdf}${label}
                </div>
                <div style="margin-left:5px; flex-grow:1; min-width:0;">
                    ${content}
                    ${imgTag}
                </div>
            </div>
        </div>
        `;
    });
    
    tempHtml += `</div>`;
    return tempHtml;
}


function createNewPreviewPage(title,previewPanel,layout) {

    const page = document.createElement('div');

    page.className = 'a4-page-preview';

    page.innerHTML = `<div class="preview-title">  ${title} </div>

        <div class="
            preview-content
            ${layout === 'two'
                ? 'two-col-layout'
                : ''
            }
        "></div>
    `;

    previewPanel.appendChild(page);

    return page.querySelector('.preview-content');
}


function renderDocument(
    tasksList,
    settings,
    container,
    type = 'question'
) {

    const wrapperStyle =
        settings.layout === "two"
            ? `
                display:grid;
                grid-template-columns:1fr 1fr;
                gap:0px 20px;
                align-content:start;
            `
            : `
                display:flex;
                flex-direction:column;
                gap:0px;
            `;

    let html = `
        <div class="pdf-wrapper"
             style="${wrapperStyle}">
    `;

    tasksList.forEach((task, index) => {

        const calcIcon =
            task.calculator
                ? `
                    <span style="
                        font-size:10px;
                        margin-right:4px;
                    ">
                        📱
                    </span>
                  `
                : '';

        // Bestäm innehåll och om det är exempel
        const isExample = !!task.example;
        let content = isExample ? task.example : (type === 'solution' ? task.solution : task.question);
        
        content = parseContent(content, task.id);

        let imgTag = '';

        if (!isExample && type === 'question' && task.img) {
            imgTag = `
                <div class="pdf-media">
                    <img
                        src="${task.img}"
                        style="
                            width:${settings.imgSize}%;
                        "
                    >
                </div>
            `;
        }

        // Styling för exempel
        const taskItemStyle = `
            font-size:10pt;
            break-inside:avoid;
            padding-bottom:${settings.spacing}px;
            width:100%;
            ${isExample ? 'border: 2px solid #000; padding: 10px; box-sizing: border-box;' : ''}
        `;

        const label = isExample 
            ? `<span style="font-weight:bold; display:block; margin-bottom:5px;">Exempel</span>`
            : `<strong>${index + 1}.</strong>`;

        html += `
            <div class="task-item"
                 style="${taskItemStyle}">

                <div style="
                    display:flex;
                    align-items:baseline;
                ">

                    <div style="
                        flex-shrink:0;
                    ">
                        ${calcIcon}
                        ${label}
                    </div>

                    <div style="
                        margin-left:5px;
                        flex-grow:1;
                        min-width:0;
                    ">
                        ${content}
                        ${imgTag}
                    </div>

                </div>
            </div>
        `;
    });

    html += `</div>`;

    container.innerHTML = html;
}





let draggedTaskId = null;

function initDragAndDrop() {
    const container = document.getElementById('previewPanel');
    if (!container || container.dataset.dragEventsInited === 'true') return;
    container.dataset.dragEventsInited = 'true';
    
    // Vi använder event delegation på preview-panelen för att hantera drop
    container.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.task-item');
        if (target) {
            draggedTaskId = parseInt(target.dataset.taskId);
            target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    container.addEventListener('dragend', (e) => {
        const target = e.target.closest('.task-item');
        if (target) {
            target.classList.remove('dragging');
        }
        // Ta bort highlight-class från alla element
        document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    });

    // När man drar över andra element
    container.addEventListener('dragover', (e) => {
        e.preventDefault(); // Nödvändigt för att tillåta drop
        const targetItem = e.target.closest('.task-item');
        
        // Ta bort highlight från alla först
        document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));

        if (targetItem && parseInt(targetItem.dataset.taskId) !== draggedTaskId) {
            targetItem.classList.add('drag-over');
        }
    });

    // När man släpper
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedTaskId && draggedTaskId !== 0) return; // 0 kan vara ett giltigt ID i vissa system, men här antar vi ID
        
        // Hitta elementet under muspekaren
        const targetItem = e.target.closest('.task-item');
        
        if (targetItem) {
            const targetId = parseInt(targetItem.dataset.taskId);

            // Se till att vi inte försöker flytta något till sig själv
            if (draggedTaskId !== targetId) {
                // 1. Hitta nuvarande index
                const fromIndex = selectedTaskIds.indexOf(draggedTaskId);
                const toIndex = selectedTaskIds.indexOf(targetId);

                // 2. Flytta i arrayen
                if (fromIndex > -1 && toIndex > -1) {
                    selectedTaskIds.splice(fromIndex, 1); // Ta bort från gammal plats
                    selectedTaskIds.splice(toIndex, 0, draggedTaskId); // Lägg in på ny plats
                    
                    // 3. Uppdatera UI
                    // Detta uppdaterar previewn och listan till höger automatiskt
                    updatePreview();
                    updateSelectedListUI(); 
                }
            }
        }
        
        draggedTaskId = null;
    });

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.preview-remove-btn');
        if (!btn) return;
        e.stopPropagation();
        const taskId = parseInt(btn.dataset.removeId, 10);
        if (!Number.isNaN(taskId)) {
            window.removeTaskById(taskId);
        }
    });
}








function createRenderContainer(settings) {

    const container = document.createElement("div");
    // Använd mm-mått för att matcha CSS (210mm A4)
    container.style.width = "210mm";
    container.style.boxSizing = "border-box";
    container.style.fontFamily = "Roboto, sans-serif";
    container.style.fontSize = "10pt";
    container.style.background = "white";
    container.style.padding = "20mm 15mm";
    container.style.color = "#000";
    container.style.lineHeight = "1.35";

    return container;
}

async function buildPaginatedDocument(tasksList, settings, type = 'question') {

    const container = createRenderContainer(settings);

    container.style.position = "absolute";
    container.style.left = "-99999px";
    container.style.top = "0";

    document.body.appendChild(container);

    // Mät px per mm dynamiskt så offscreen-renderingen matchar CSS-måtten
    const pxPerMm = (function(){
        const test = document.createElement('div');
        test.style.width = '100mm';
        test.style.position = 'absolute';
        test.style.visibility = 'hidden';
        document.body.appendChild(test);
        const pxPer100mm = test.offsetWidth;
        document.body.removeChild(test);
        return pxPer100mm / 100;
    })();

    const firstPageUsableMm = 262; // befintliga logiska värden (kan justeras senare)
    const otherPageUsableMm = 277;

    const firstPageUsablePx = firstPageUsableMm * pxPerMm;
    const otherPageUsablePx = otherPageUsableMm * pxPerMm;

    // Definiera layout-stilen
    const wrapperStyle = settings.layout === "two"
        ? `display: grid; grid-template-columns: 1fr 1fr; gap: 0px 20px; align-content: start;`
        : `display: flex; flex-direction: column; gap: 0px;`;
    
    let currentPage = document.createElement("div");
    currentPage.className = "pdf-page";
    
    currentPage.innerHTML = `<div class="preview-title">${settings.title}</div>
        <div class="pdf-wrapper" style="${wrapperStyle}"></div>`;

    container.appendChild(currentPage);

    let wrapper = currentPage.querySelector(".pdf-wrapper");

    let questionCounter = 0;

        for (let i = 0; i < tasksList.length; i++) {

        const task = tasksList[i];
        
        // --- NY KOLL: Är det en egen textruta? ---
        const isCustomText = task.id < 0;
        
        let content = "";
        let isExample = false; // Vi behandlar egna texter som "exempel" gällande layout

        if (isCustomText) {
            // Hämta texten från vår state
            const textData = customTextBlocks[task.id];
            content = textData ? textData.content : "";
            isExample = true; // Använd exempel-stil (ram)
        } else {
            // --- VANLIG UPPGIFT (Din befintliga logik) ---
            isExample = !!task.example;
            if (type === "solution") {
                if (isExample) continue; 
                content = task.solution;
            } else {
                content = isExample ? task.example : task.question;
            }
        }

        content = parseContent(content, task.id); // Behandla formler/tabeller

        let imgTag = "";
        
        // Egna textrutor har inga bilder (för enkelhetens skull), 
        // men om du vill lägga till det senare kan du göra det här.
        if (!isCustomText && !isExample && type === 'question' && task.img) {
            const imgWidth = customTaskImgWidths[task.id]
                ? `${customTaskImgWidths[task.id]}px`
                : `${settings.imgSize}%`;

            imgTag = `
                <div class="pdf-media">
                    <img src="${task.img}"
                         data-task-id="${task.id}"
                         style="width:${imgWidth};">
                </div>
            `;
        }

        const taskElement = document.createElement("div");
        taskElement.className = "task-item";
        if (isCustomText) taskElement.classList.add('custom-text-task');

        let styleCss = `
            font-size:10pt;
            break-inside:avoid;
            width:100%;
        `;

        // --- STYLING: Exempel har ram, egna textrutor får enkel layout
        if (isExample || isCustomText) {
            styleCss += `
                border: 2px solid #000;
                box-sizing: border-box;
                padding: 10px; 
                margin-bottom: 15px; 
                grid-column: 1 / -1; /* Tvinga fullbredd */
            `;
        } else {
            styleCss += `margin-bottom: ${settings.spacing}px;`;
        }

        styleCss += 'position: relative;';
        taskElement.style.cssText = styleCss;

        taskElement.setAttribute('draggable', 'true');
        taskElement.dataset.taskId = task.id;

        const calcIconPdf = (!isCustomText && task.calculator) ? '<span style="font-size:11pt; margin-right:4px;">📱</span>' : '';

        let labelHtml = "";
        if (isCustomText) {
            labelHtml = `<span style="font-weight:bold; display:block; margin-bottom:5px;"></span>`;
        } else if (isExample) {
            labelHtml = `<span style="font-weight:bold; display:block; margin-bottom:5px;">Exempel</span>`;
        } else {
            if (type === "question") {
                questionCounter++;
                labelHtml = `${calcIconPdf}<strong>${questionCounter}.</strong>`;
            } else if (type === "solution") {
                questionCounter++;
                labelHtml = `<strong>${questionCounter}.</strong>`;
            }
        }

        let bodyContent = content;
        if (isCustomText) {
            const textValue = escapeHtml(customTextBlocks[task.id]?.content || "");
            bodyContent = `
                <div style="display:block; width:100%; position:relative;">
                    <div
                        contenteditable="true"
                        class="custom-text-preview"
                        data-custom-text-id="${task.id}"
                        spellcheck="false"
                        style="width:100%; box-sizing:border-box; white-space:pre-wrap; outline:none; border:none; padding:4px 0 0 0; background:transparent; font-family:inherit; font-size:10pt; line-height:1.5;"
                        oninput="window.updateCustomTextContent(${task.id}, this.innerText, false)"
                        onblur="window.updateCustomTextContent(${task.id}, this.innerText, true)"
                        onmousedown="event.stopPropagation();"
                        onpointerdown="event.stopPropagation();"
                        ondragstart="event.preventDefault();"
                    >${textValue}</div>
                </div>
            `;
        }

        taskElement.innerHTML = `
            <button class="preview-remove-btn" type="button" data-remove-id="${task.id}" aria-label="Ta bort uppgift">✕</button>
            <div style="display:flex; align-items:baseline;">
                <div style="flex-shrink:0;">
                    ${labelHtml}
                </div>
                <div style="margin-left:5px; flex-grow:1; min-width:0;">
                    ${bodyContent}
                    ${imgTag}
                </div>
            </div>
        `;

        wrapper.appendChild(taskElement);
        
        // ... Resten av koden (MathJax och paginering) är oförändrad ...
        
        if (window.MathJax) {
            try {
                await MathJax.typesetPromise([taskElement]);
            } catch (mje) {
                console.error('MathJax typeset error on taskElement:', mje);
            }
        }
        
        currentPage.offsetHeight; 
        
        const limit =
            container.children.length === 1
                ? firstPageUsablePx
                : otherPageUsablePx;

        
        if (currentPage.offsetHeight > limit) {
            const isFirstTaskOnPage = currentPage.querySelectorAll('.task-item').length === 1;
        
            if (!isFirstTaskOnPage) {
                wrapper.removeChild(taskElement);
        
                currentPage = document.createElement("div");
                currentPage.className = "pdf-page";
                currentPage.innerHTML = `<div class="pdf-wrapper" style="${wrapperStyle}"></div>`;
                container.appendChild(currentPage);
                wrapper = currentPage.querySelector(".pdf-wrapper");
                wrapper.appendChild(taskElement);
        
                if (window.MathJax) {
                    try {
                        await MathJax.typesetPromise([taskElement]);
                    } catch (mje) {
                        console.error('MathJax typeset error on taskElement (new page):', mje);
                    }
                }
            }
        }
    }

    return container;
}

// --- FUNKTION: Gör bilder i previewn resizable ---
function makeImagesResizable() {
    const previewPanel = document.getElementById('previewPanel');
    if (!previewPanel) return;

    const images = previewPanel.querySelectorAll('.a4-page-preview img');
    
    images.forEach(img => {
        // Skipa om redan gjort
        if (img.dataset.resizable === 'true') return;
        
        img.dataset.resizable = 'true';
        img.style.maxWidth = 'none';
        const currentWidth = img.style.width || window.getComputedStyle(img).width || '200px';
        img.style.width = currentWidth;
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.marginBottom = '10px';
        
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        
        img.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Bara vänster musknapp
            
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = img.offsetWidth;
            startHeight = img.offsetHeight;
            
            img.classList.add('resizing');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Använd deltaX för att justera båda width och height (aspect ratio)
            const newWidth = Math.max(50, startWidth + deltaX);
            img.style.width = newWidth + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                img.classList.remove('resizing');

                const taskId = img.dataset.taskId;
                if (taskId) {
                    customTaskImgWidths[taskId] = img.offsetWidth;
                }

                updatePreview();
            }
        });
    });
}

async function updatePreview() {

    const previewPanel =
        document.getElementById('previewPanel') ||
        document.querySelector('.preview-panel');

    const prevScrollTop = previewPanel.scrollTop;
    const prevScrollLeft = previewPanel.scrollLeft;

    previewPanel.innerHTML = "";

    // --- FIX HÄR: Hantera negativa ID:n (egna textrutor) ---
    const selectedTasks = selectedTaskIds.map(id => {
        if (id < 0) {
            return { id: id }; // Skapa en mock-uppgift för texten
        } else {
            return window.tasks.find(t => t.id === id);
        }
    }).filter(t => t !== undefined); // Filtrera bort undefined om en uppgift råkar saknas

    if (selectedTasks.length === 0) {

        previewPanel.innerHTML = `
            <div style="
                color:#ccc;
                text-align:center;
                margin-top:100px;
                font-style:italic;
            ">
                Välj uppgifter för att se förhandsgranskning...
            </div>
        `;

        return;
    }

    const settings = {
        title:
            document.getElementById('pdfTitle')?.value ||
            "Arbetsblad",

        spacing:
            parseInt(document.getElementById('spacingSlider')?.value || 20),

        imgSize:
            parseInt(document.getElementById('imgSizeSlider')?.value || 100),

        layout:
            document.querySelector('input[name="layout"]:checked')?.value || "one"
    };

    let container;
    try {
        container = await buildPaginatedDocument(selectedTasks, settings, 'question');
    } catch (err) {
        console.error('Preview build error:', err);
        previewPanel.innerHTML = `<div style="padding:20px; color:#a00;">Ett fel uppstod vid bygg av förhandsgranskning:<br><pre style="white-space:pre-wrap; color:#900;">${(err && err.message) ? err.message : String(err)}</pre></div>`;
        return;
    }

    const pages =
        container.querySelectorAll(".pdf-page");

    // --- LOGIK: Skapa en wrapper för zoomning ---
    const scaleWrapper = document.createElement('div');
    scaleWrapper.id = 'preview-scale-wrapper';
    scaleWrapper.style.display = 'flex';
    scaleWrapper.style.flexDirection = 'column';
    scaleWrapper.style.alignItems = 'center';
    scaleWrapper.style.transformOrigin = 'top center'; 
    scaleWrapper.style.transition = 'transform 0.2s ease-out'; 
    scaleWrapper.style.width = '100%';

    pages.forEach(page => {
        const previewPage = document.createElement("div");
        previewPage.className = "a4-page-preview";
        previewPage.innerHTML = page.innerHTML;
        scaleWrapper.appendChild(previewPage);
    });

    previewPanel.appendChild(scaleWrapper);

    // --- RÄKNA UT SKALA ---
    const firstPageInContainer = container.querySelector('.pdf-page');
    const originalPageWidth = firstPageInContainer ? firstPageInContainer.offsetWidth : 794;
    
    const panelWidth = previewPanel.clientWidth;
    const availableWidth = panelWidth - 40; 
    
    let scale = availableWidth / originalPageWidth;

    if (scale > 1) scale = 1;
    if (scale < 0.2) scale = 0.2;

    scaleWrapper.style.transform = `scale(${scale})`;

    makeImagesResizable();
    
    initDragAndDrop();

    requestAnimationFrame(() => {
        previewPanel.scrollTop = prevScrollTop;
        previewPanel.scrollLeft = prevScrollLeft;
    });

    document.body.removeChild(container);


    adjustPdfZoom();  //070826
}



// Funktion för att konvertera enkelt textformat till HTML-tabell
function parseSimpleTables(text) {
    // Letar efter {table ... }
    return text.replace(/\{table([\s\S]*?)\}/g, function(match, content) {
        const rows = content.trim().split('\n');
        let html = '<table class="task-table">';
        
        rows.forEach((row, index) => {
            if (row.trim() === '') return; // Hoppa över tomma rader
            
            // Dela raden vid |
            const cells = row.split('|').map(cell => cell.trim());
            const tag = (index === 0) ? 'th' : 'td'; // Första raden blir rubrik (<th>)
            
            html += '<tr>';
            cells.forEach(cell => {
                html += `<${tag}>${cell}</${tag}>`;
            });
            html += '</tr>';
        });
        
        html += '</table>';
        return html;
    });
}


// --- NYTT: Hjälpfunktion för att lägga till drag-events ---
function addDragEvents(li) {
    li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', li.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
        li.style.opacity = '0.5';
    });

    li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        li.style.opacity = '1';
    });

    li.addEventListener('dragover', (e) => {
        e.preventDefault(); // Nödvändigt för att tillåta drop
        e.dataTransfer.dropEffect = 'move';
    });

    li.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = parseInt(li.dataset.index);

        if (fromIndex !== toIndex) {
            // Flytta objektet i arrayen
            const item = selectedTaskIds.splice(fromIndex, 1)[0];
            selectedTaskIds.splice(toIndex, 0, item);
            
            // Återrendera listan
            updateSelectedListUI();
            updatePreview();
        }
    });
}

// --- Sorteringsfunktioner (Uppdaterad med Drag & Drop) ---
// --- Sorteringsfunktioner (Uppdaterad) ---
function updateSelectedListUI() {
    const listContainer = document.getElementById('selectedList');
    const boxContainer = document.getElementById('selectionBox');

    if (!listContainer || !boxContainer) {
        return;
    }
    
    if (selectedTaskIds.length === 0) {
        boxContainer.style.display = 'none';
        listContainer.innerHTML = '';
        return;
    }

    boxContainer.style.display = 'block';
    
    // Töm listan
    listContainer.innerHTML = '';

    let displayCounter = 1;

    selectedTaskIds.forEach((id, index) => {
        const li = document.createElement('li');
        li.style.cssText = `
            display: flex; 
            align-items: flex-start; 
            justify-content: space-between; 
            padding: 10px; 
            border-bottom: 1px solid #eee; 
            background: white; 
            cursor: grab;
            user-select: none;
        `;
        li.setAttribute('draggable', 'true');
        li.dataset.index = index;

        // Kolla om det är en textruta (negativt ID) eller vanlig uppgift
        const isCustomText = id < 0;
        
        let contentHtml = '';

        if (isCustomText) {
            // --- RENDERA TEXTRUTA I LISTAN ---
            const textData = customTextBlocks[id] || { content: "" };
            contentHtml = `
                <div style="flex-grow: 1; margin-right: 10px;">
                    <strong style="color:#d9534f;">Egen text</strong>
                    <textarea 
                        style="width:100%; margin-top:5px; padding:5px; font-family:inherit; resize:vertical;"
                        rows="2"
                        placeholder="Skriv din instruktion här..."
                        oninput="updateCustomTextContent(${id}, this.value)"
                    >${textData.content}</textarea>
                </div>
            `;
        } else {
            // --- RENDERA VANLIG UPPGIFT (Befintlig logik) ---
            const task = tasks.find(t => t.id === id);
            if (!task) return; // Hoppa om uppgift saknas

            const isExample = !!task.example;
            let prefix = isExample 
                ? `<span style="font-weight:bold; color:#d9534f;">Exempel</span>` 
                : `<small>${displayCounter}.</small>`;
            
            if (!isExample) displayCounter++;

            const contentText = isExample ? task.example : task.question;
            const questionHtml = parseContent(contentText || '', id);

            contentHtml = `
                <span style="flex-grow: 1; margin-right: 10px; pointer-events: none;">
                    ${prefix} 
                    <strong>${task.area}</strong> - <span class="math-preview">${questionHtml}</span>
                    ${!isExample ? `<small style="color: #666; display:block; margin-top:2px;">(Nivå: ${task.difficulty || ''})</small>` : ''}
                </span>
            `;
        }

        li.innerHTML = `
            ${contentHtml}
            <button class="remove-btn" data-index="${index}" style="cursor: pointer; color: red; padding: 5px; background: none; border: none; font-size: 16px; flex-shrink:0;">✕</button>
        `;

        // Förhindra drag-and-drop när man skriver i textarean
        const textarea = li.querySelector('textarea');
        if (textarea) {
            textarea.addEventListener('mousedown', (e) => e.stopPropagation()); // Stoppa drag-start
            li.style.cursor = 'default'; // Ändra markör
            li.setAttribute('draggable', 'false'); // Stäng av drag på just denna li om man klickar i rutan (görs dynamiskt nedan)
            
            // Återställ draggable om man klickar utanför
            li.addEventListener('mousedown', (e) => {
                if(e.target !== textarea) li.setAttribute('draggable', 'true');
            });
        }

        addDragEvents(li);
        listContainer.appendChild(li);
    });

    // Lyssnare för ta-bort-knappar
    const removeBtns = listContainer.querySelectorAll('.remove-btn');
    removeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            removeTask(idx);
        });
    });

    if (window.MathJax) {
        MathJax.typesetPromise([listContainer]).catch((err) => console.log('MathJax error:', err));
    }
}

window.removeTask = function(index) {
    const idToRemove = selectedTaskIds[index];
    
    // Ta bort ur huvudlistan
    selectedTaskIds.splice(index, 1);
    
    // Om det var en egen textruta, ta bort innehållet
    if (idToRemove < 0) {
        delete customTextBlocks[idToRemove];
    }
    
    updateSelectedListUI();
    updatePreview();

    // --- Uppdatera UI i vänstermenyn (vanliga uppgifter) ---
    // (Denna del ser ut som din gamla kod, behåll den eller justera vid behov)
    const checkbox = document.querySelector(`input[type="checkbox"][value="${idToRemove}"]`);
    if (checkbox) {
        checkbox.checked = false;
        const taskDiv = checkbox.closest('.task');
        if (taskDiv) {
            const taskObj = tasks.find(t => t.id === idToRemove);
            if (taskObj) {
                const groupId = taskObj.groupId || `single_${taskObj.id}`;
                const hasSelection = selectedTaskIds.some(id => {
                    const t = tasks.find(x => x.id === id);
                    return t && (t.groupId || `single_${t.id}`) === groupId;
                });
                if (hasSelection) taskDiv.classList.add('task-group-selected');
                else taskDiv.classList.remove('task-group-selected');
            }
        }
    }

    const versionBtn = document.querySelector(`.version-btn[data-id="${idToRemove}"]`);
    if (versionBtn) {
        versionBtn.classList.remove('selected');
    }
}

window.removeTaskById = function(taskId) {
    const index = selectedTaskIds.indexOf(taskId);
    if (index === -1) return;
    removeTask(index);
};

function isPageEmpty(page) {
    // Ta bort whitespace
    const text = page.textContent.replace(/\s+/g, '');

    // Kolla om det finns riktiga element (inte bara tomma bilder/divar)
    const hasMeaningfulContent = page.querySelector(
        '.task-item, p, table, svg, mjx-container'
    );

    return text === "" && !hasMeaningfulContent;
}


async function generatePDF() {

    const previewPanel = document.getElementById('previewPanel');

    if (!previewPanel || previewPanel.children.length === 0) {
        alert("Ingen förhandsgranskning finns.");
        return;
    }

    const printRoot = document.createElement("div");
    printRoot.id = "print-root";

    // ✅ 1. Lägg till frågesidor
    const questionPages = previewPanel.querySelectorAll('.a4-page-preview');

    
    questionPages.forEach(page => {
        if (!isPageEmpty(page)) {
            const clone = page.cloneNode(true);
            printRoot.appendChild(clone);
        }
    });

    // --- FIX HÄR: Hantera negativa ID:n (egna textrutor) ---
    // Vi gör samma mappning här för att slippa krasch vid generering
    const allSelectedTasks = selectedTaskIds.map(id => {
        if (id < 0) {
            return { id: id };
        } else {
            return window.tasks.find(t => t.id === id);
        }
    }).filter(t => t !== undefined);

    // ✅ 2. Lägg till lösningar
    // Vi filtrerar bort exempel OCH egna textrutor från lösningssidan (om du inte vill ha texten där)
    const solutionTasks = allSelectedTasks.filter(t => !t.example && t.id >= 0);

    if (solutionTasks.length > 0) {

        const settings = {
            title: "Lösningar",
            spacing: 10,
            imgSize: parseInt(document.getElementById('imgSizeSlider')?.value || 100),
            layout: document.querySelector('input[name="layout"]:checked')?.value || "one"
        };

        const solutionContainer = await buildPaginatedDocument(
            solutionTasks,
            settings,
            'solution'
        );

        const solutionPages = solutionContainer.querySelectorAll(".pdf-page");

        solutionPages.forEach(solPage => {
            if (!isPageEmpty(solPage)) {
                const div = document.createElement("div");
                div.className = "a4-page-preview";
                div.innerHTML = solPage.innerHTML;
                printRoot.appendChild(div);
            }
        });
    }

    document.body.appendChild(printRoot);

    setTimeout(() => {
        window.print();

        setTimeout(() => {
            document.body.removeChild(printRoot);
        }, 500);
    }, 50);
}


async function appendSolutionsToPDF(doc, scale) {
    const selectedTasks = selectedTaskIds.map(id =>
        window.tasks.find(t => t.id === id)
    );

    const solutionTasks = selectedTasks.filter(t => !t.example);

    if (solutionTasks.length === 0) return;

    // ✅ skapa TEMP preview (offscreen)
    const settings = {
        title: "Lösningar",
        spacing: 10,
        imgSize: parseInt(document.getElementById('imgSizeSlider')?.value || 100),
        layout: document.querySelector('input[name="layout"]:checked')?.value || "one"
    };

    const container = await buildPaginatedDocument(
        solutionTasks,
        settings,
        'solution'
    );

    const pages = container.querySelectorAll(".pdf-page");

    document.body.appendChild(container);

    // ✅ konvertera till preview-format
    const tempPreviews = [];

    pages.forEach(page => {
        const div = document.createElement("div");
        div.className = "a4-page-preview";
        div.innerHTML = page.innerHTML;
        document.body.appendChild(div);
        tempPreviews.push(div);
    });

    // ✅ PARALLELL rendering
    const canvases = await Promise.all(
        tempPreviews.map(page =>
            html2canvas(page, {
                scale: scale,
                useCORS: true,
                backgroundColor: "#ffffff"
            })
        )
    );

    canvases.forEach((canvas) => {
        doc.addPage();

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgProps = doc.getImageProperties(imgData);
        const imgHeight = (imgProps.height * 210) / imgProps.width;

        doc.addImage(imgData, "JPEG", 0, 0, 210, imgHeight);
    });

    // ✅ cleanup (superviktigt)
    document.body.removeChild(container);
    tempPreviews.forEach(el => document.body.removeChild(el));
}


// --- Event Listener för Slider ---
const slider = document.getElementById('spacingSlider');
const sliderValueDisplay = document.getElementById('spacingValue');

if (slider) {
    slider.addEventListener('input', (e) => {
        sliderValueDisplay.textContent = `${e.target.value}px`;
    });
}


// =========================
// LIVE PREVIEW LISTENERS
// =========================

const titleInput = document.getElementById('pdfTitle');
if (titleInput) {
    titleInput.addEventListener('input', updatePreview);
}

// Layout
const layoutInputs = document.querySelectorAll('input[name="layout"]');
layoutInputs.forEach(input => {
    input.addEventListener('change', updatePreview);
});

// Spacing
const spacingSlider = document.getElementById('spacingSlider');
if (spacingSlider) {
    spacingSlider.addEventListener('input', updatePreview);
}

// Image Size
const imgSizeSlider = document.getElementById('imgSizeSlider');
const imgSizeValueDisplay = document.getElementById('imgSizeValue');
if (imgSizeSlider) {
    imgSizeSlider.addEventListener('input', (e) => {
        imgSizeValueDisplay.textContent = `${e.target.value}%`;
        updatePreview();
    });
}

window.toggleBrSpacing = function() {
    extraBrSpacing = !extraBrSpacing;
    updateBrSpacingButton();
    updatePreview();
};

function updateBrSpacingButton() {
    const btn = document.getElementById('brSpacingButton');
    if (!btn) return;
    if (extraBrSpacing) {
        btn.classList.add('active');
        btn.textContent = 'Större skrivyta: PÅ';
    } else {
        btn.classList.remove('active');
        btn.textContent = 'Större skrivyta?';
    }
}

updateBrSpacingButton();


// --- Start ---
initFilters();
document.getElementById('pdfBtn').addEventListener('click', generatePDF);
document.getElementById('clearBtn').addEventListener('click', clearSelection);

updatePreview();

//Logga ut-funktionalitet
async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    alert("Kunde inte logga ut");
    return;
  }

  console.log("Utloggad!");

  // Skicka tillbaka till login
  window.location.href = "./login.html";
}