# Email Marketing Integration - Part 1: Customer Segmentation Strategies and Logic

## Executive Summary

This document outlines the customer segmentation strategies and logic for integrating email marketing capabilities into the CRM system. The segmentation approach enables targeted, personalized email campaigns based on comprehensive customer data analysis.

## 1. Current CRM Data Structure Analysis

### 1.1 Available Lead Data Fields

Based on the existing [`Lead`](../prisma/schema.prisma:150-172) model, the following data points are available for segmentation:

**Core Identity Fields:**
- `firstName`, `lastName` - Personal identification
- `email` - Primary communication channel
- `phone` - Secondary communication channel
- `company` - Organization affiliation
- `position` - Job title/role

**Sales Process Fields:**
- `status` - Current lead status (new, contacted, qualified, proposal, negotiation, won, lost)
- `stage` - Pipeline stage progression
- `value` - Estimated deal value
- `pipelineId` - Associated sales pipeline

**Behavioral Fields:**
- `source` - Lead acquisition source
- `tags` - Custom categorization (JSON array)
- `notes` - Qualitative information
- `createdAt`, `updatedAt` - Temporal data

### 1.2 Available Lead List Data

The [`LeadList`](../prisma/schema.prisma:174-185) model provides:
- Grouping capability for leads
- Custom categorization
- Color-coded visualization
- Workspace-level organization

### 1.3 Available Pipeline Data

The [`Pipeline`](../prisma/schema.prisma:136-148) model provides:
- Sales process stages
- Pipeline-specific lead organization
- Custom stage definitions

## 2. Segmentation Strategy Framework

### 2.1 Segmentation Dimensions

The segmentation system will support multiple dimensions for flexible targeting:

#### A. Demographic Segmentation
- **Company Size**: Based on company name patterns or custom tags
- **Industry**: Extracted from company or position fields
- **Geographic**: Inferred from company location or custom tags
- **Job Role**: Derived from position field (executive, manager, individual contributor)

#### B. Behavioral Segmentation
- **Lead Source**: Website, referral, event, social media, etc.
- **Engagement Level**: Based on interaction frequency (notes, updates)
- **Activity Timeline**: Recent activity vs. dormant leads
- **Response Patterns**: Historical email engagement (when implemented)

#### C. Sales Stage Segmentation
- **Pipeline Stage**: Current position in sales funnel
- **Lead Status**: Qualification level
- **Deal Value**: High-value vs. low-value opportunities
- **Velocity**: Time spent in current stage

#### D. Custom Segmentation
- **Tag-Based**: Using existing tags field
- **Lead List Membership**: Existing lead list groupings
- **Custom Attributes**: User-defined criteria

### 2.2 Segmentation Operators

The segmentation engine will support the following operators:

**Comparison Operators:**
- Equals (`==`)
- Not equals (`!=`)
- Greater than (`>`)
- Less than (`<`)
- Greater than or equal (`>=`)
- Less than or equal (`<=`)

**String Operators:**
- Contains
- Starts with
- Ends with
- Matches regex

**Collection Operators:**
- In list
- Not in list
- Contains any (for arrays)
- Contains all (for arrays)

**Date Operators:**
- Before
- After
- Between
- In last X days
- In next X days

**Logical Operators:**
- AND
- OR
- NOT

## 3. Segmentation Logic Implementation

### 3.1 Segmentation Rule Structure

Each segmentation rule will follow this structure:

```typescript
interface SegmentationRule {
  id: string
  name: string
  description?: string
  workspaceId: string
  criteria: Criterion[]
  logicOperator: 'AND' | 'OR'
  isActive: boolean
  createdAt: DateTime
  updatedAt: DateTime
}

interface Criterion {
  field: string
  operator: string
  value: any
  negate?: boolean
}
```

### 3.2 Predefined Segmentation Templates

The system will include these common segmentation templates:

#### Template 1: New Leads (Last 7 Days)
```json
{
  "name": "New Leads - Last 7 Days",
  "criteria": [
    {
      "field": "createdAt",
      "operator": "in_last_days",
      "value": 7
    },
    {
      "field": "status",
      "operator": "equals",
      "value": "new"
    }
  ],
  "logicOperator": "AND"
}
```

#### Template 2: High-Value Opportunities
```json
{
  "name": "High-Value Opportunities",
  "criteria": [
    {
      "field": "value",
      "operator": "greater_than_or_equal",
      "value": 10000
    },
    {
      "field": "status",
      "operator": "in_list",
      "value": ["qualified", "proposal", "negotiation"]
    }
  ],
  "logicOperator": "AND"
}
```

#### Template 3: Dormant Leads (No Activity 30+ Days)
```json
{
  "name": "Dormant Leads - 30+ Days",
  "criteria": [
    {
      "field": "updatedAt",
      "operator": "before_days_ago",
      "value": 30
    },
    {
      "field": "status",
      "operator": "not_in_list",
      "value": ["won", "lost"]
    }
  ],
  "logicOperator": "AND"
}
```

#### Template 4: Decision Makers
```json
{
  "name": "Decision Makers",
  "criteria": [
    {
      "field": "position",
      "operator": "contains_any",
      "value": ["CEO", "CTO", "CFO", "Director", "VP", "President", "Owner"]
    }
  ],
  "logicOperator": "OR"
}
```

#### Template 5: Pipeline Stage - Negotiation
```json
{
  "name": "In Negotiation",
  "criteria": [
    {
      "field": "stage",
      "operator": "equals",
      "value": "negotiation"
    },
    {
      "field": "status",
      "operator": "equals",
      "value": "negotiation"
    }
  ],
  "logicOperator": "OR"
}
```

### 3.3 Dynamic Segmentation Logic

The segmentation engine will support dynamic evaluation:

```typescript
interface DynamicSegmentation {
  rule: SegmentationRule
  evaluate: (lead: Lead) => boolean
  refreshInterval?: number // in minutes
  cacheResults?: boolean
}
```

#### Evaluation Algorithm

1. **Parse Criteria**: Convert criteria into executable functions
2. **Apply Logic Operator**: Combine criteria using AND/OR logic
3. **Handle Negation**: Apply NOT operator where specified
4. **Cache Results**: Store results for performance (if enabled)
5. **Refresh Cache**: Update based on refresh interval

### 3.4 Segmentation Performance Optimization

#### Caching Strategy
- **Result Caching**: Cache segmentation results for 15-60 minutes
- **Partial Updates**: Update only changed leads
- **Incremental Evaluation**: Evaluate new/modified leads only

#### Indexing Strategy
- Create database indexes on frequently filtered fields:
  - `lead.status`
  - `lead.stage`
  - `lead.value`
  - `lead.createdAt`
  - `lead.updatedAt`
  - `lead.source`

#### Query Optimization
- Use batch queries for large segments
- Implement pagination for segment preview
- Use database aggregation for segment statistics

## 4. Advanced Segmentation Features

### 4.1 Behavioral Scoring

Implement lead scoring based on behavior:

```typescript
interface LeadScore {
  leadId: string
  score: number
  factors: ScoreFactor[]
  lastCalculated: DateTime
}

interface ScoreFactor {
  type: 'engagement' | 'activity' | 'value' | 'velocity'
  weight: number
  value: number
  description: string
}
```

**Scoring Factors:**
- **Engagement**: Frequency of interactions (notes, updates)
- **Activity**: Recent activity (time decay function)
- **Value**: Deal value normalized
- **Velocity**: Movement through pipeline stages

### 4.2 Predictive Segmentation

Leverage machine learning for predictive segmentation:

```typescript
interface PredictiveSegment {
  id: string
  name: string
  modelType: 'conversion_probability' | 'churn_risk' | 'next_best_action'
  threshold: number
  confidence: number
  lastTrained: DateTime
}
```

**Predictive Models:**
- **Conversion Probability**: Likelihood of lead conversion
- **Churn Risk**: Probability of lead disengagement
- **Next Best Action**: Recommended engagement strategy

### 4.3 A/B Test Segmentation

Support segmentation for A/B testing:

```typescript
interface ABTestSegment {
  testId: string
  variant: 'A' | 'B' | 'control'
  assignmentCriteria: Criterion[]
  sampleSize: number
  assignmentDate: DateTime
}
```

## 5. Segmentation Management UI

### 5.1 Segmentation Builder Interface

**Features:**
- Visual rule builder with drag-and-drop
- Real-time segment size preview
- Criteria validation
- Save and reuse templates
- Import/export segmentation rules

### 5.2 Segment Dashboard

**Display Elements:**
- List of all segments
- Segment sizes (lead count)
- Last updated timestamp
- Active/inactive status
- Quick actions (edit, duplicate, delete, preview)

### 5.3 Segment Preview

**Preview Features:**
- Show sample leads matching criteria
- Display segment statistics
- Export segment data
- Test segmentation rules

## 6. Integration Points

### 6.1 Campaign Integration

Segments will be used for:
- Campaign targeting
- Automated email sequences
- Drip campaigns
- One-time broadcasts

### 6.2 Analytics Integration

Segment data will feed into:
- Campaign performance analytics
- Conversion funnel analysis
- ROI calculation
- A/B test results

### 6.3 CRM Integration

Segments will integrate with:
- Lead list management
- Pipeline stages
- Lead status updates
- Activity tracking

## 7. Data Privacy and Compliance

### 7.1 GDPR Considerations
- Explicit consent for marketing emails
- Right to opt-out
- Data deletion requests
- Data export functionality

### 7.2 CAN-SPAM Compliance
- Clear opt-out mechanisms
- Accurate sender information
- Physical address inclusion
- Honor opt-out requests promptly

### 7.3 Data Security
- Encrypt sensitive lead data
- Role-based access control
- Audit logging for segmentation changes
- Regular security reviews

## 8. Implementation Phases

### Phase 1: Basic Segmentation
- Static segmentation rules
- Basic operators (equals, contains, in list)
- Simple UI builder
- Manual refresh

### Phase 2: Advanced Segmentation
- Dynamic segmentation
- Advanced operators (date ranges, regex)
- Caching and performance optimization
- Segment templates

### Phase 3: Intelligent Segmentation
- Lead scoring
- Behavioral analysis
- Predictive models
- A/B test support

## 9. Success Metrics

### 9.1 Technical Metrics
- Segmentation query performance (< 2 seconds for 10K leads)
- Cache hit rate (> 80%)
- API response time (< 500ms)

### 9.2 Business Metrics
- Campaign open rate improvement
- Click-through rate improvement
- Conversion rate improvement
- Reduced unsubscribe rate

## 10. Next Steps

This segmentation foundation will enable:
1. Targeted email campaigns
2. Automated drip sequences
3. Personalized content delivery
4. Performance tracking and optimization

The next part will detail the database schema extensions required to support email marketing features.

---

**Document Status**: Part 1 of 8
**Related Documents**: 
- Part 2: Database Schema Extensions
- Part 3: Email Service Provider Integration
- Part 4: Campaign Management Workflow
- Part 5: Performance Tracking Metrics
- Part 6: API Endpoints and Service Layer
- Part 7: Frontend Components and UI Design
- Part 8: Implementation Roadmap
