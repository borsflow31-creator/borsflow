import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up existing system templates and categories...');
  
  // We only clean up system templates and the specific categories we're about to seed
  // to avoid accidentally deleting user-created data if this is run in a production-like environment
  const categorySlugs = [
    'productivity',
    'marketing-sales',
    'project-management',
    'finance-legal',
    'human-resources',
    'personal'
  ];

  await prisma.universalTemplate.deleteMany({
    where: { isSystem: true }
  });

  await prisma.templateCategory.deleteMany({
    where: { slug: { in: categorySlugs } }
  });

  console.log('Seeding categories...');

  const categories = await Promise.all([
    prisma.templateCategory.create({
      data: {
        name: 'Productivity',
        slug: 'productivity',
        description: 'Tools to help you get more done in less time.',
        icon: 'Zap',
        order: 1,
      },
    }),
    prisma.templateCategory.create({
      data: {
        name: 'Marketing & Sales',
        slug: 'marketing-sales',
        description: 'Templates for growing your business and managing leads.',
        icon: 'TrendingUp',
        order: 2,
      },
    }),
    prisma.templateCategory.create({
      data: {
        name: 'Project Management',
        slug: 'project-management',
        description: 'Organize tasks, track progress, and collaborate with your team.',
        icon: 'Layout',
        order: 3,
      },
    }),
    prisma.templateCategory.create({
      data: {
        name: 'Finance & Legal',
        slug: 'finance-legal',
        description: 'Manage invoices, quotes, and legal agreements.',
        icon: 'Scale',
        order: 4,
      },
    }),
    prisma.templateCategory.create({
      data: {
        name: 'Human Resources',
        slug: 'human-resources',
        description: 'Streamline hiring, onboarding, and employee management.',
        icon: 'Users',
        order: 5,
      },
    }),
    prisma.templateCategory.create({
      data: {
        name: 'Personal',
        slug: 'personal',
        description: 'Organize your life, hobbies, and personal goals.',
        icon: 'User',
        order: 6,
      },
    }),
  ]);

  const categoryMap = categories.reduce((acc, cat) => {
    acc[cat.slug] = cat.id;
    return acc;
  }, {} as Record<string, string>);

  console.log('Seeding system templates...');

  const templates = [
    // Productivity
    {
      name: 'Meeting Notes',
      description: 'A clean layout for capturing meeting minutes, action items, and decisions.',
      type: 'page',
      categoryId: categoryMap['productivity'],
      icon: 'FileText',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        blocks: [
          { type: 'heading', content: { text: 'Meeting Notes', level: 1 } },
          { type: 'text', content: { text: 'Date: ' + new Date().toLocaleDateString() } },
          { type: 'heading', content: { text: 'Attendees', level: 2 } },
          { type: 'list', content: { items: ['Attendee 1', 'Attendee 2'] } },
          { type: 'heading', content: { text: 'Agenda', level: 2 } },
          { type: 'text', content: { text: 'Enter agenda items here...' } },
          { type: 'heading', content: { text: 'Action Items', level: 2 } },
          { type: 'todo', content: { text: 'Follow up on X', completed: false } },
        ]
      }),
      tags: JSON.stringify(['meeting', 'notes', 'productivity'])
    },
    {
      name: 'Company Wiki',
      description: 'The central hub for all company knowledge, policies, and information.',
      type: 'page',
      categoryId: categoryMap['productivity'],
      icon: 'Globe',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        blocks: [
          { type: 'heading', content: { text: 'Company Wiki', level: 1 } },
          { type: 'text', content: { text: 'Welcome to our central knowledge base.' } },
          { type: 'heading', content: { text: 'Departments', level: 2 } },
          { type: 'text', content: { text: '• Engineering\n• Marketing\n• Sales\n• HR' } },
        ]
      }),
      tags: JSON.stringify(['wiki', 'knowledge', 'company'])
    },
    {
      name: 'Weekly Planner',
      description: 'Organize your week with clear goals and daily task lists.',
      type: 'page',
      categoryId: categoryMap['productivity'],
      icon: 'Calendar',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        blocks: [
          { type: 'heading', content: { text: 'Weekly Planner', level: 1 } },
          { type: 'heading', content: { text: 'Top 3 Goals for the Week', level: 2 } },
          { type: 'todo', content: { text: 'Goal 1', completed: false } },
          { type: 'heading', content: { text: 'Monday', level: 2 } },
          { type: 'todo', content: { text: 'Task 1', completed: false } },
        ]
      }),
      tags: JSON.stringify(['planner', 'weekly', 'tasks'])
    },

    // Marketing & Sales
    {
      name: 'Sales Pipeline',
      description: 'Track your deals from initial contact to closing.',
      type: 'kanban',
      categoryId: categoryMap['marketing-sales'],
      icon: 'BarChart2',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        stages: ['Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
      }),
      tags: JSON.stringify(['sales', 'crm', 'pipeline'])
    },
    {
      name: 'Client Proposal',
      description: 'A professional template for sending quotes and service proposals.',
      type: 'quote',
      categoryId: categoryMap['marketing-sales'],
      icon: 'FileText',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        items: [
          { description: 'Service Description', quantity: 1, unitPrice: 1000 }
        ],
        terms: 'Payment is due within 30 days.'
      }),
      tags: JSON.stringify(['proposal', 'sales', 'client'])
    },
    {
      name: 'Content Calendar',
      description: 'Plan and track your social media, blog, and video content.',
      type: 'kanban',
      categoryId: categoryMap['marketing-sales'],
      icon: 'Image',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        stages: ['Idea', 'Researching', 'Drafting', 'Review', 'Published']
      }),
      tags: JSON.stringify(['content', 'marketing', 'calendar'])
    },

    // Project Management
    {
      name: 'Project Roadmap',
      description: 'High-level overview of project milestones and timeline.',
      type: 'kanban',
      categoryId: categoryMap['project-management'],
      icon: 'Map',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        stages: ['Backlog', 'In Planning', 'In Progress', 'Testing', 'Done']
      }),
      tags: JSON.stringify(['project', 'roadmap', 'planning'])
    },
    {
      name: 'Software Development Sprint',
      description: 'Agile sprint board for managing development tasks.',
      type: 'kanban',
      categoryId: categoryMap['project-management'],
      icon: 'Code',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        stages: ['To Do', 'Doing', 'Done']
      }),
      tags: JSON.stringify(['software', 'development', 'agile', 'sprint'])
    },

    // Finance & Legal
    {
      name: 'Professional Invoice',
      description: 'Standard invoice template for billing clients.',
      type: 'invoice',
      categoryId: categoryMap['finance-legal'],
      icon: 'CreditCard',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        items: [],
        terms: 'Please pay within 15 days.'
      }),
      tags: JSON.stringify(['invoice', 'finance', 'billing'])
    },
    {
      name: 'Service Agreement Quote',
      description: 'Detailed quote with terms and conditions for service agreements.',
      type: 'quote',
      categoryId: categoryMap['finance-legal'],
      icon: 'FileCheck',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        items: [],
        terms: 'This agreement is subject to the following terms...'
      }),
      tags: JSON.stringify(['agreement', 'legal', 'quote'])
    },
    {
      name: 'Monthly Expense Report',
      description: 'Track and categorize monthly business expenses.',
      type: 'invoice',
      categoryId: categoryMap['finance-legal'],
      icon: 'DollarSign',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        items: [],
        terms: ''
      }),
      tags: JSON.stringify(['expenses', 'finance', 'report'])
    },

    // Human Resources
    {
      name: 'Employee Onboarding',
      description: 'Checklist and information hub for new hires.',
      type: 'page',
      categoryId: categoryMap['human-resources'],
      icon: 'UserPlus',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        blocks: [
          { type: 'heading', content: { text: 'New Hire Onboarding', level: 1 } },
          { type: 'heading', content: { text: 'Before Your First Day', level: 2 } },
          { type: 'todo', content: { text: 'Sign contract', completed: false } },
          { type: 'todo', content: { text: 'Complete background check', completed: false } },
        ]
      }),
      tags: JSON.stringify(['hr', 'onboarding', 'employee'])
    },
    {
      name: 'Hiring Pipeline',
      description: 'Track candidates through the recruitment process.',
      type: 'kanban',
      categoryId: categoryMap['human-resources'],
      icon: 'Search',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        stages: ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']
      }),
      tags: JSON.stringify(['hiring', 'recruitment', 'hr'])
    },

    // Personal
    {
      name: 'Personal Journal',
      description: 'Daily reflections and personal thoughts.',
      type: 'page',
      categoryId: categoryMap['personal'],
      icon: 'Book',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        blocks: [
          { type: 'heading', content: { text: 'Daily Reflection', level: 1 } },
          { type: 'text', content: { text: 'How was my day?' } },
          { type: 'text', content: { text: 'What am I grateful for?' } },
        ]
      }),
      tags: JSON.stringify(['journal', 'personal', 'reflection'])
    },
    {
      name: 'Habit Tracker',
      description: 'Track your daily habits and stay consistent.',
      type: 'page',
      categoryId: categoryMap['personal'],
      icon: 'CheckCircle',
      isSystem: true,
      isPublic: true,
      content: JSON.stringify({
        blocks: [
          { type: 'heading', content: { text: 'Monthly Habit Tracker', level: 1 } },
          { type: 'todo', content: { text: 'Workout', completed: false } },
          { type: 'todo', content: { text: 'Read for 30 mins', completed: false } },
          { type: 'todo', content: { text: 'Meditate', completed: false } },
        ]
      }),
      tags: JSON.stringify(['habits', 'personal', 'consistency'])
    },
  ];

  for (const template of templates) {
    await prisma.universalTemplate.create({
      data: template
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
