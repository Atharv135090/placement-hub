import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = "AIzaSyCmnwbXQimf3SPzCvHyBHVojTqMqjkdYZ0";

let genAI = null;
let model = null;

function isValidGeminiKey(key) {
  return key && key.startsWith("AIzaSy") && key.length > 30;
}

function getGeminiModel() {
  if (!model && isValidGeminiKey(GEMINI_API_KEY)) {
    try {
      genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    } catch (err) {
      console.error("Failed to initialize Gemini:", err);
      model = null;
    }
  }
  return model;
}

export function getPlacementContext(applications, companies, savedIds, profile, user) {
  var savedCompanies = companies.filter(function(c) { return savedIds.includes(c.id); });
  var interviews = applications.filter(function(a) { return a.status === "interview"; });
  var shortlisted = applications.filter(function(a) { return a.status === "shortlisted"; });
  return {
    totalApplications: applications.length,
    applied: applications.filter(function(a) { return a.status === "applied"; }).length,
    shortlisted: shortlisted.length,
    interviews: interviews.length,
    offers: applications.filter(function(a) { return a.status === "offer" || a.status === "selected"; }).length,
    rejected: applications.filter(function(a) { return a.status === "rejected"; }).length,
    applicationDetails: applications.map(function(a) { return a.companyName + " — " + (a.role || "N/A") + " (" + a.status + ")"; }),
    savedCompanyNames: savedCompanies.map(function(c) { return c.name; }),
    totalCompanies: companies.length,
    branch: (profile && profile.branch) || "Not specified",
    gradYear: (profile && profile.gradYear) || "Not specified",
    userName: (profile && profile.displayName) || (user && user.displayName) || "there",
  };
}

function buildSystemPrompt(ctx) {
  var prompt = "You are Placement Hub Assistant — a helpful, friendly AI for college students.\n" +
    "You can answer ANY question: coding, CS concepts, general knowledge, career advice, daily life, jokes, translations, study plans, email writing, and more.\n" +
    "You also have access to the user's placement data. Use it when relevant.\n" +
    "Respond naturally and conversationally. Use markdown for code blocks and formatting.\n" +
    "Keep answers concise but complete. If the user asks for code, provide working code examples.\n" +
    "Do not restrict yourself to placement topics — answer everything like a general-purpose AI assistant.";

  if (ctx) {
    prompt += "\n\nUser's placement data:\n" +
      "- Name: " + (ctx.userName || "Student") + "\n" +
      "- Branch: " + (ctx.branch || "N/A") + "\n" +
      "- Graduation Year: " + (ctx.gradYear || "N/A") + "\n" +
      "- Total Applications: " + (ctx.totalApplications || 0) + "\n" +
      "- Applied: " + (ctx.applied || 0) + "\n" +
      "- Shortlisted: " + (ctx.shortlisted || 0) + "\n" +
      "- Interviews: " + (ctx.interviews || 0) + "\n" +
      "- Offers: " + (ctx.offers || 0) + "\n" +
      "- Rejected: " + (ctx.rejected || 0) + "\n" +
      "- Application Details: " + (ctx.applicationDetails || []).join("; ") + "\n" +
      "- Total Companies: " + (ctx.totalCompanies || 0);
  }

  return prompt;
}

export async function generateSmartResponse(query, ctx, messages) {
  var geminiModel = getGeminiModel();

  if (geminiModel) {
    try {
      var systemPrompt = buildSystemPrompt(ctx);

      var chatHistory = (messages || []).slice(0, -1).map(function(m) {
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        };
      });

      var chat = geminiModel.startChat({
        history: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Understood. I'm ready to help with anything!" }] },
        ].concat(chatHistory),
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.9,
        },
      });

      var result = await chat.sendMessage(query);
      var responseText = result.response.text();
      if (responseText && responseText.trim()) {
        return responseText;
      }
      return generateFallbackResponse(query, ctx);
    } catch (err) {
      console.error("Gemini API error:", err.message || err);
      if (err.message && err.message.includes("API key")) {
        console.warn("Invalid API key. Using fallback responses.");
      }
      return generateFallbackResponse(query, ctx);
    }
  }

  console.warn("Gemini model not available. Using fallback responses.");
  return generateFallbackResponse(query, ctx);
}

function generateFallbackResponse(query, ctx) {
  var lower = query.toLowerCase().trim();

  if (/^(hi|hello|hey|howdy|sup|yo|hola|namaste|good\s*(morning|afternoon|evening|night)|greetings)/i.test(lower)) {
    var time = new Date().getHours();
    var greeting = time < 12 ? "Good morning" : time < 17 ? "Good afternoon" : "Good evening";
    return greeting + ", " + ctx.userName + "! I'm your Placement Hub Assistant. I can help with anything — coding, placement prep, general questions, or just chat. What's on your mind?";
  }

  if (/^(bye|goodbye|see you|ttyl|gn|goodnight)/i.test(lower)) {
    return "Goodbye, " + ctx.userName + "! Feel free to come back anytime. Good luck with your placement journey!";
  }

  if (/^(thanks|thank you|thx|ty|tysm|appreciate)/i.test(lower)) {
    return "You're welcome, " + ctx.userName + "! Happy to help. Let me know if there's anything else.";
  }

  if (/^(who are you|what are you|your name|what's your name|ur name)/i.test(lower)) {
    return "I'm the **Placement Hub Assistant** — your personal AI copilot for placements and beyond.\n\nI can help with:\n- Placement tracking and company insights\n- Coding, DSA, and CS concepts\n- Interview preparation\n- Career advice and resume tips\n- General knowledge and everyday questions\n\nJust ask me anything!";
  }

  if (/^(what is my name|my name|who am i|what's my name)/i.test(lower)) {
    return "You're **" + ctx.userName + "**! You're logged into Placement Hub.";
  }

  if (/which companies|what companies|my applications|companies have i applied/i.test(lower)) {
    if (ctx.applicationDetails.length === 0) {
      return "You haven't applied to any companies yet. Browse the **Companies** page to find available placement drives and start applying!";
    }
    return "Here are the companies you've applied to:\n\n" + ctx.applicationDetails.map(function(a) { return "- **" + a + "**"; }).join("\n") + "\n\n**Total: " + ctx.totalApplications + "** application(s).";
  }

  if (/how many.*(applied|application)|count.*(applied|application)|total application/i.test(lower)) {
    return "You have **" + ctx.totalApplications + "** application(s):\n\n- Applied: **" + ctx.applied + "**\n- Shortlisted: **" + ctx.shortlisted + "**\n- Interviews: **" + ctx.interviews + "**\n- Offers: **" + ctx.offers + "**\n- Rejected: **" + ctx.rejected + "**";
  }

  if (/joke|funny|laugh/i.test(lower)) {
    var jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs!",
      "Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
      "A SQL query walks into a bar, sees two tables, and asks... 'Can I JOIN you?'",
      "Why do Java developers wear glasses? Because they can't C#!",
      "What's a programmer's favorite hangout place? Foo Bar!",
      "How many programmers does it take to change a light bulb? None — that's a hardware problem!",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  if (/^what time|^current time|^tell.*time/i.test(lower)) {
    return "The current time is **" + new Date().toLocaleTimeString() + "** and the date is **" + new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + "**.";
  }

  if (/capital of/i.test(lower)) {
    var capitals = { japan: "Tokyo", india: "New Delhi", china: "Beijing", "united states": "Washington D.C.", usa: "Washington D.C.", uk: "London", "united kingdom": "London", france: "Paris", germany: "Berlin", australia: "Canberra", canada: "Ottawa", brazil: "Brasília", russia: "Moscow", "south korea": "Seoul", italy: "Rome", spain: "Madrid", egypt: "Cairo", mexico: "Mexico City" };
    for (var country in capitals) {
      if (lower.includes(country)) {
        return "The capital of **" + country.charAt(0).toUpperCase() + country.slice(1) + "** is **" + capitals[country] + "**.";
      }
    }
    return "Which country's capital are you looking for? Try 'capital of Japan'.";
  }

  if (/binary search/i.test(lower)) {
    return "**Binary Search** — efficient algorithm for sorted arrays.\n\n**How it works:**\n1. Compare target with middle element\n2. If target < middle → search left half\n3. If target > middle → search right half\n4. Repeat until found or space empty\n\n**Python:**\n```python\ndef binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: left = mid + 1\n        else: right = mid - 1\n    return -1\n```\n\n**Time:** O(log n) | **Space:** O(1)";
  }

  if (/resume|cv/i.test(lower)) {
    return "**Resume Guide for Placement:**\n\n1. **Contact Info** — Full name, email, phone, LinkedIn, GitHub\n2. **Summary** — Your best skills + what you're looking for\n3. **Education** — College, degree, CGPA\n4. **Skills** — Languages, Frameworks, Tools\n5. **Projects** — Use action verbs, mention tech stack, quantify impact\n6. **Achievements** — Competitive programming, hackathons, certifications\n\n**Tips:** Keep it 1 page, ATS-friendly, consistent formatting.";
  }

  if (/what is (a |an |the )?(machine learning|ml|deep learning|dl|artificial intelligence|ai|neural network|nlp|natural language processing)/i.test(lower)) {
    var topics = {
      "machine learning": "**Machine Learning (ML)** — A subset of AI where systems learn from data without being explicitly programmed.\n\n**Types:**\n- Supervised Learning (labeled data)\n- Unsupervised Learning (no labels)\n- Reinforcement Learning (reward-based)\n\n**Common Algorithms:**\n- Linear/Logistic Regression\n- Decision Trees, Random Forest\n- SVM, KNN\n- Neural Networks\n\n**Applications:** Recommendation systems, fraud detection, image recognition, NLP.",
      "deep learning": "**Deep Learning** — A subset of ML using neural networks with multiple layers (deep neural networks).\n\n**Key Concepts:**\n- Neural Networks (input → hidden layers → output)\n- CNNs (images), RNNs/LSTMs (sequences), Transformers (NLP)\n- Training via backpropagation\n\n**Frameworks:** TensorFlow, PyTorch, Keras\n\n**Applications:** Image recognition, self-driving cars, ChatGPT, voice assistants.",
      "artificial intelligence": "**Artificial Intelligence (AI)** — Simulation of human intelligence by machines.\n\n**Types:**\n- Narrow AI (specific tasks)\n- General AI (human-level intelligence)\n- Super AI (beyond human)\n\n**Branches:**\n- Machine Learning\n- Natural Language Processing\n- Computer Vision\n- Robotics\n\n**AI is everywhere:** Search engines, recommendations, autonomous vehicles, virtual assistants.",
      "neural network": "**Neural Network** — Computing system inspired by biological brain neurons.\n\n**Structure:**\n- Input Layer → Hidden Layers → Output Layer\n- Each neuron: weighted sum + activation function\n\n**Types:**\n- Feedforward, CNN, RNN, LSTM, Transformer\n\n**Training:** Forward pass → Loss calculation → Backpropagation → Update weights",
      "nlp": "**Natural Language Processing (NLP)** — AI for understanding human language.\n\n**Tasks:**\n- Text Classification (sentiment analysis)\n- Named Entity Recognition (NER)\n- Machine Translation\n- Question Answering\n- Text Generation\n\n**Modern Approach:** Transformers (BERT, GPT, T5) — attention mechanism revolutionized NLP."
    };
    for (var key in topics) {
      if (lower.includes(key)) return topics[key];
    }
  }

  if (/what is (a |an |the )?(hash|hashing|hash map|hash table|dictionary|object)/i.test(lower)) {
    return "**Hash Map / Dictionary** — Data structure mapping keys to values using hash function.\n\n**How it works:**\n1. Hash function converts key → index\n2. Store value at that index\n3. Lookup is O(1) average\n\n**Python:**\n```python\nmy_dict = {\"name\": \"John\", \"age\": 25}\nprint(my_dict[\"name\"])  # John\n```\n\n**Time Complexity:**\n- Average: O(1) for get/put\n- Worst: O(n) (hash collisions)\n\n**Use cases:** Caching, counting, quick lookups.";
  }

  if (/explain.*(oop|object oriented|classes|inheritance|polymorphism|encapsulation|abstraction)/i.test(lower)) {
    return "**Object-Oriented Programming (OOP)** — Programming paradigm using objects and classes.\n\n**4 Pillars:**\n1. **Encapsulation** — Bundling data + methods, hiding internals\n2. **Inheritance** — Child class inherits parent's properties\n3. **Polymorphism** — Same method, different behavior\n4. **Abstraction** — Hide complexity, show only essential features\n\n**Example (Python):**\n```python\nclass Animal:\n    def speak(self): pass\n\nclass Dog(Animal):\n    def speak(self): return \"Woof!\"\n\nprint(Dog().speak())  # Woof!\n```\n\n**Languages:** Java, Python, C++, C#";
  }

  if (/what is (a |an |the )?(stack|queue|linked list|tree|graph|heap)/i.test(lower)) {
    var ds = {
      "stack": "**Stack** — LIFO (Last In, First Out) data structure.\n\n**Operations:**\n- push(x) — Add to top\n- pop() — Remove from top\n- peek() — View top\n- isEmpty() — Check if empty\n\n**Python:**\n```python\nstack = []\nstack.append(1)  # push\nstack.pop()      # pop\n```\n\n**Use cases:** Undo/redo, function calls, expression evaluation, bracket matching.\n\n**Time:** O(1) for all operations.",
      "queue": "**Queue** — FIFO (First In, First Out) data structure.\n\n**Operations:**\n- enqueue(x) — Add to rear\n- dequeue() — Remove from front\n- front() — View front\n\n**Python:**\n```python\nfrom collections import deque\nq = deque()\nq.append(1)    # enqueue\nq.popleft()    # dequeue\n```\n\n**Use cases:** BFS, task scheduling, print queue, buffering.\n\n**Time:** O(1) for all operations.",
      "linked list": "**Linked List** — Linear data structure with nodes containing data + pointer.\n\n**Types:**\n- Singly Linked (one direction)\n- Doubly Linked (both directions)\n\n**Node:** data → next → data → next → null\n\n**Python:**\n```python\nclass Node:\n    def __init__(self, data):\n        self.data = data\n        self.next = None\n```\n\n**Advantages:** Dynamic size, efficient insert/delete at head.\n**Disadvantages:** No random access, extra memory for pointers.",
      "tree": "**Tree** — Hierarchical data structure with nodes.\n\n**Types:**\n- Binary Tree (max 2 children)\n- Binary Search Tree (BST): left < root < right\n- AVL Tree (balanced)\n- Heap (min/max)\n\n**Traversal:**\n- Inorder (Left → Root → Right)\n- Preorder (Root → Left → Right)\n- Postorder (Left → Right → Root)\n\n**Use cases:** File systems, databases, DOM, decision trees.",
      "graph": "**Graph** — Collection of vertices (nodes) + edges (connections).\n\n**Types:**\n- Directed / Undirected\n- Weighted / Unweighted\n- Cyclic / Acyclic\n\n**Representations:**\n- Adjacency Matrix\n- Adjacency List\n\n**Algorithms:**\n- BFS, DFS (traversal)\n- Dijkstra (shortest path)\n- Topological Sort\n\n**Use cases:** Social networks, maps, recommendations.",
    };
    for (var key in ds) {
      if (lower.includes(key)) return ds[key];
    }
  }

  if (/what is (a |an |the )?(api|rest api|graphql|endpoint|http)/i.test(lower)) {
    return "**API (Application Programming Interface)** — Set of rules for software communication.\n\n**REST API:**\n- Uses HTTP methods: GET, POST, PUT, DELETE\n- Stateless, resource-based URLs\n- Returns JSON/XML\n\n**Example:**\n```javascript\nfetch(\"https://api.example.com/users/1\")\n  .then(res => res.json())\n  .then(data => console.log(data));\n```\n\n**HTTP Methods:**\n- GET — Retrieve data\n- POST — Create data\n- PUT — Update data\n- DELETE — Remove data\n\n**Status Codes:** 200 (OK), 404 (Not Found), 500 (Server Error)";
  }

  if (/what is (a |an |the )?(closure|callback|promise|async|await|event loop)/i.test(lower)) {
    return "**JavaScript Async Concepts:**\n\n**Closure:** Function that remembers its outer scope variables.\n```javascript\nfunction outer() {\n  let count = 0;\n  return function inner() { return ++count; };\n}\n```\n\n**Callback:** Function passed as argument to another function.\n\n**Promise:** Object representing eventual completion/failure.\n```javascript\nfetch(url).then(res => res.json()).catch(err => console.error(err));\n```\n\n**Async/Await:** Syntactic sugar for Promises.\n```javascript\nasync function getData() {\n  const res = await fetch(url);\n  return res.json();\n}\n```\n\n**Event Loop:** Handles async operations — callback queue, microtask queue, call stack.";
  }

  if (/what is (a |an |the )?(database|db|sql|nosql|mysql|postgres|mongodb)/i.test(lower)) {
    return "**Database** — Organized collection of structured data.\n\n**Types:**\n- **SQL** (Relational): MySQL, PostgreSQL, SQLite\n  - Tables with rows/columns\n  - Uses SQL queries\n- **NoSQL** (Non-relational): MongoDB, Redis, Firebase\n  - Flexible schemas (documents, key-value)\n\n**SQL Basics:**\n```sql\nSELECT * FROM users WHERE age > 21;\nINSERT INTO users (name, age) VALUES ('John', 25);\n```\n\n**When to use:**\n- SQL: Structured data, ACID compliance\n- NoSQL: Flexible schema, horizontal scaling";
  }

  if (/what is (a |an |the )?(react|angular|vue|nextjs|next\.js|frontend|frontend framework)/i.test(lower)) {
    return "**Frontend Frameworks:**\n\n**React** (Meta)\n- Component-based, virtual DOM\n- Uses JSX, hooks (useState, useEffect)\n- Largest ecosystem\n\n**Angular** (Google)\n- Full framework, TypeScript\n- Two-way data binding, dependency injection\n\n**Vue.js** (Community)\n- Progressive, easy learning curve\n- Combines best of React & Angular\n\n**Next.js** (Vercel) — React framework with SSR/SSG\n- File-based routing, API routes\n\n**Choose React for:** Flexibility, job market, community support.";
  }

  if (/how (do|can|to) (i |we )?(prepare|study|learn|crack|interview)/i.test(lower)) {
    return "**Placement Preparation Roadmap:**\n\n**1. DSA (3-4 months)**\n- Arrays, Strings, Linked Lists\n- Trees, Graphs, DP\n- Practice: LeetCode, Codeforces\n\n**2. CS Fundamentals**\n- OS: Process, Thread, Deadlock, Memory\n- DBMS: SQL, Normalization, Indexing\n- CN: OSI, TCP/IP, HTTP, DNS\n\n**3. System Design**\n- Scalability, Load Balancing\n- Caching, Database Design\n- URL: \"System Design Interview\" by Alex Xu\n\n**4. Projects (2-3)**\n- Full-stack or relevant to role\n- Deploy and document on GitHub\n\n**5. Resume & Communication**\n- STAR method for behavioral\n- Mock interviews: Pramp, InterviewBit\n\n**Daily:** 2-3 DSA problems + 1 CS concept";
  }

  if (/what is (a |an |the )?(git|github|version control|repository|commit|branch|merge)/i.test(lower)) {
    return "**Git & GitHub:**\n\n**Git** — Version control system tracking code changes.\n\n**GitHub** — Cloud platform for Git repos + collaboration.\n\n**Essential Commands:**\n```bash\ngit init                    # New repo\ngit clone <url>             # Clone repo\ngit add .                   # Stage changes\ngit commit -m \"message\"     # Commit\ngit push origin main        # Push to remote\ngit pull                    # Pull changes\ngit branch feature          # Create branch\ngit checkout feature        # Switch branch\ngit merge feature           # Merge branch\n```\n\n**Best Practices:**\n- Commit often with clear messages\n- Use branches for features\n- Write meaningful PR descriptions";
  }

  if (/what is (a |an |the )?(docker|container|kubernetes|k8s|devops|ci.cd|deployment)/i.test(lower)) {
    return "**Docker & DevOps:**\n\n**Docker** — Platform for building, shipping, running containers.\n\n**Key Concepts:**\n- **Image** — Blueprint for containers\n- **Container** — Running instance of image\n- **Dockerfile** — Instructions to build image\n\n**Basic Commands:**\n```bash\ndocker build -t myapp .     # Build image\ndocker run -p 3000:3000 myapp  # Run container\ndocker ps                   # List running containers\n```\n\n**CI/CD:** Automated testing + deployment pipeline.\n- GitHub Actions, Jenkins, GitLab CI\n- Auto-deploy on push to main";
  }

  if (/what is (a |an |the )?(sort|sorting|bubble sort|merge sort|quick sort|insertion sort)/i.test(lower)) {
    return "**Sorting Algorithms:**\n\n| Algorithm | Time (Avg) | Space | Stable |\n|-----------|------------|-------|--------|\n| Bubble | O(n²) | O(1) | Yes |\n| Insertion | O(n²) | O(1) | Yes |\n| Merge | O(n log n) | O(n) | Yes |\n| Quick | O(n log n) | O(log n) | No |\n| Heap | O(n log n) | O(1) | No |\n\n**Merge Sort (Python):**\n```python\ndef merge_sort(arr):\n    if len(arr) <= 1: return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)\n\narr = [38, 27, 43, 3, 9, 82, 10]\nprint(merge_sort(arr))\n```\n\n**When to use:**\n- Small data: Insertion Sort\n- Large data: Merge/Quick Sort";
  }

  if (/what is (a |an |the )?(dbms|database management|normalization|acid|transaction)/i.test(lower)) {
    return "**DBMS Concepts:**\n\n**Normalization:** Organizing data to reduce redundancy.\n- 1NF: Atomic values, no repeating groups\n- 2NF: 1NF + no partial dependency\n- 3NF: 2NF + no transitive dependency\n\n**ACID Properties:**\n- **Atomicity** — All or nothing\n- **Consistency** — Valid state transitions\n- **Isolation** — Concurrent transactions don't interfere\n- **Durability** — Committed data persists\n\n**SQL:**\n```sql\nSELECT department, COUNT(*) as total\nFROM employees\nGROUP BY department\nHAVING COUNT(*) > 5;\n```";
  }

  if (/what is (a |an |the )?(os|operating system|process|thread|deadlock|memory management|virtual memory|paging)/i.test(lower)) {
    return "**Operating System Concepts:**\n\n**Process vs Thread:**\n- Process: Independent program in execution\n- Thread: Lightweight process, shares memory\n\n**Scheduling:**\n- FCFS, SJF, Round Robin, Priority\n\n**Deadlock:** Four conditions:\n1. Mutual Exclusion\n2. Hold and Wait\n3. No Preemption\n4. Circular Wait\n\n**Memory Management:**\n- Contiguous Allocation\n- Paging: Fixed-size blocks\n- Segmentation: Variable-size blocks\n- Virtual Memory: Use disk as extension of RAM\n\n**Page Replacement:** FIFO, LRU, Optimal";
  }

  if (/what is (a |an |the )?(computer network|cn|networking|tcp|ip|http|dns|osi model|tcp.ip)/i.test(lower)) {
    return "**Computer Networks:**\n\n**OSI Model (7 layers):**\n1. Physical — Cables, signals\n2. Data Link — MAC addressing\n3. Network — IP addressing, routing\n4. Transport — TCP/UDP, ports\n5. Session — Connections\n6. Presentation — Encryption, compression\n7. Application — HTTP, FTP, DNS\n\n**TCP vs UDP:**\n- TCP: Reliable, ordered, slower\n- UDP: Fast, no guarantee\n\n**HTTP Methods:**\n- GET, POST, PUT, DELETE, PATCH\n\n**DNS:** Domain name → IP address translation\n\n**IP Addressing:**\n- IPv4: 32-bit (192.168.1.1)\n- IPv6: 128-bit";
  }

  if (/what is (a |an |the )?(python|java|javascript|c\+\+|programming language)/i.test(lower)) {
    return "**Programming Languages:**\n\n**Python**\n- Easy syntax, vast libraries\n- Uses: ML, AI, web, automation\n\n**Java**\n- Write once, run anywhere (JVM)\n- Uses: Enterprise, Android, backend\n\n**JavaScript**\n- Browser + server (Node.js)\n- Uses: Web development, full-stack\n\n**C++**\n- High performance, manual memory\n- Uses: Systems, gaming, competitive\n\n**Which to learn first?**\n- Web Dev → JavaScript\n- ML/AI → Python\n- Competitive → C++\n- Enterprise → Java";
  }

  if (/what is (a |an |the )?(data structure|dsa|algorithm)/i.test(lower)) {
    return "**Data Structures & Algorithms (DSA):**\n\n**Data Structures:**\n- Arrays, Strings\n- Linked Lists\n- Stacks, Queues\n- Trees (Binary, BST, Trie)\n- Graphs\n- Hash Maps\n\n**Algorithms:**\n- Sorting: Merge, Quick, Heap\n- Searching: Binary Search, BFS, DFS\n- Dynamic Programming\n- Greedy Algorithms\n- Backtracking\n\n**Why DSA Matters:**\n- Efficient code\n- Problem-solving skills\n- Interview requirement\n\n**Practice:** LeetCode, Codeforces, GeeksforGeeks";
  }

  if (/help me|how (do|can) i|what (should|can) i|explain|tell me about|what is|define|meaning of/i.test(lower)) {
    var topic = query.replace(/^(help me|how (do|can) i|what (should|can) i|explain|tell me about|what is|define|meaning of)\s*/i, "").trim();
    if (topic) {
      return "I'd love to help with **\"" + topic + "\"**, but I'm currently running in offline mode (API unavailable).\n\nHere's what I'd suggest:\n\n- Try again later when the AI service is back online\n- Search for **\"" + topic + "\"** on Google or YouTube for detailed explanations\n- Check resources like **GeeksforGeeks**, **LeetCode**, or **Stack Overflow** for technical topics\n\nI'm sorry I can't give you a full answer right now. The online AI will handle this when available!";
    }
  }

  return "I understand you're asking about **\"" + query + "\"**.\n\nI'm currently running in offline mode (AI service unavailable), so I can't generate a full response right now.\n\n**Here's what you can do:**\n\n- **Try again later** — The online AI service will handle your question with a detailed answer\n- **Search for it** — Try Google, YouTube, or **Stack Overflow**\n- **Rephrase your question** — Sometimes being more specific helps\n\n**Meanwhile, I can help offline with these common topics:**\n- Binary search, sorting, data structures (stack, queue, tree, graph)\n- OOP, databases, SQL, networking\n- OS concepts, Git, Docker\n- Resume tips, interview preparation\n- Jokes and time\n\nJust ask about any of these and I'll answer directly!";

}
