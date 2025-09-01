-- Create OpenAI API logs table for tracking all API calls
CREATE TABLE openai_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    question_id INTEGER REFERENCES questions(id),
    answer_id INTEGER REFERENCES answers(id),
    
    -- Request data
    prompt TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    
    -- Response data
    response_text TEXT,
    score INTEGER,
    feedback TEXT,
    criteria_scores JSONB, -- Store the criteriaScores object
    
    -- Performance metrics
    tokens_used INTEGER,
    response_time_ms INTEGER,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'error'
    error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_openai_logs_user_id ON openai_logs(user_id);
CREATE INDEX idx_openai_logs_question_id ON openai_logs(question_id);
CREATE INDEX idx_openai_logs_answer_id ON openai_logs(answer_id);
CREATE INDEX idx_openai_logs_status ON openai_logs(status);
CREATE INDEX idx_openai_logs_created_at ON openai_logs(created_at);

-- Create composite index for user activity tracking
CREATE INDEX idx_openai_logs_user_created ON openai_logs(user_id, created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE openai_logs IS 'Comprehensive logging for all OpenAI API calls and responses';
COMMENT ON COLUMN openai_logs.prompt IS 'Full prompt sent to OpenAI API';
COMMENT ON COLUMN openai_logs.criteria_scores IS 'JSON object containing individual criteria scores';
COMMENT ON COLUMN openai_logs.response_time_ms IS 'API response time in milliseconds';
COMMENT ON COLUMN openai_logs.tokens_used IS 'Number of tokens consumed by the API call';